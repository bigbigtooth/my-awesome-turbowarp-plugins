// Name: 百炼大模型
// ID: dashscopeAI
// Description: 调用阿里百炼大模型 API（通义千问），支持文字对话、语音识别、语音合成
// License: MIT

(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("百炼大模型扩展必须在非沙箱模式下运行。");
  }

  class DashscopeAI {
    constructor() {
      this.lastReply = "";
      this.lastSTT = "";
      this.audioCtx = null;
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.isRecording = false;
      this.currentAudio = null;
    }

    getInfo() {
      return {
        id: "dashscopeAI",
        name: "百炼大模型",
        color1: "#FF6A00",
        color2: "#E55D00",
        color3: "#CC5200",
        blocks: [
          // --- LLM 对话 ---
          {
            opcode: "whenReplyReceived",
            blockType: Scratch.BlockType.EVENT,
            text: "当收到大模型回复时",
            isEdgeActivated: false,
          },
          {
            opcode: "ask",
            blockType: Scratch.BlockType.COMMAND,
            text: "使用 API Key [KEY] 向模型 [MODEL] 提问 [QUESTION]",
            arguments: {
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
              MODEL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "qwen-flash",
              },
              QUESTION: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "你是谁？",
              },
            },
          },
          {
            opcode: "getReply",
            blockType: Scratch.BlockType.REPORTER,
            text: "大模型的回答",
          },
          "---",
          // --- 语音识别 (STT) ---
          {
            opcode: "whenSTTReceived",
            blockType: Scratch.BlockType.EVENT,
            text: "当语音识别完成时",
            isEdgeActivated: false,
          },
          {
            opcode: "startRecording",
            blockType: Scratch.BlockType.COMMAND,
            text: "开始录音",
          },
          {
            opcode: "stopRecordingAndRecognize",
            blockType: Scratch.BlockType.COMMAND,
            text: "停止录音并使用 API Key [KEY] 识别语音",
            arguments: {
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
            },
          },
          {
            opcode: "getSTT",
            blockType: Scratch.BlockType.REPORTER,
            text: "语音识别结果",
          },
          "---",
          // --- 语音合成 (TTS) ---
          {
            opcode: "whenTTSReady",
            blockType: Scratch.BlockType.EVENT,
            text: "当语音合成完成时",
            isEdgeActivated: false,
          },
          {
            opcode: "speak",
            blockType: Scratch.BlockType.COMMAND,
            text: "使用 API Key [KEY] 将 [TEXT] 合成为语音",
            arguments: {
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
              TEXT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "你好，世界！",
              },
            },
          },
          {
            opcode: "playTTS",
            blockType: Scratch.BlockType.COMMAND,
            text: "播放合成语音",
          },
          {
            opcode: "stopTTS",
            blockType: Scratch.BlockType.COMMAND,
            text: "停止播放语音",
          },
        ],
      };
    }

    // ============ LLM 对话 ============

    whenReplyReceived() {}

    ask(args) {
      const apiKey = args.KEY.trim();
      const question = args.QUESTION;
      const model = args.MODEL.trim();

      if (!apiKey) {
        this.lastReply = "[错误：API Key 为空]";
        this._emit("whenReplyReceived");
        return;
      }

      const body = {
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: question },
        ],
      };

      Scratch.fetch(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      )
        .then((r) => {
          if (!r.ok) return r.text().then((t) => Promise.reject(t));
          return r.json();
        })
        .then((data) => {
          if (data.choices && data.choices.length > 0) {
            this.lastReply = data.choices[0].message.content;
          } else {
            this.lastReply = "[错误：API 未返回有效回复]";
          }
        })
        .catch((err) => {
          this.lastReply = `[请求失败：${err}]`;
        })
        .finally(() => this._emit("whenReplyReceived"));
    }

    getReply() {
      return this.lastReply;
    }

    // ============ 语音识别 (STT) ============

    whenSTTReceived() {}

    startRecording() {
      if (this.isRecording) return;
      this.audioChunks = [];

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
          });
          this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
          };
          this.mediaRecorder.start();
          this.isRecording = true;
        })
        .catch((err) => {
          this.lastSTT = `[录音失败：${err.message}]`;
          this._emit("whenSTTReceived");
        });
    }

    stopRecordingAndRecognize(args) {
      const apiKey = args.KEY.trim();

      if (!this.isRecording || !this.mediaRecorder) {
        this.lastSTT = "[错误：未在录音中]";
        this._emit("whenSTTReceived");
        return;
      }
      if (!apiKey) {
        this.lastSTT = "[错误：API Key 为空]";
        this._emit("whenSTTReceived");
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        const tracks = this.mediaRecorder.stream.getTracks();
        tracks.forEach((t) => t.stop());

        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.audioChunks = [];

        console.log("[百炼STT] 音频大小:", audioBlob.size, "类型:", audioBlob.type);
        this._callSTT(apiKey, audioBlob);
      };

      this.mediaRecorder.stop();
    }

    _callSTT(apiKey, audioBlob) {
      const formData = new FormData();
      formData.append("model", "paraformer-v2");
      formData.append("file", audioBlob, "recording.webm");

      console.log("[百炼STT] 使用原生 fetch + FormData 发送识别请求");
      console.log("[百炼STT] audioBlob size:", audioBlob.size, "type:", audioBlob.type);

      fetch(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      )
        .then((r) => {
          console.log("[百炼STT] 响应状态:", r.status);
          if (!r.ok) return r.text().then((t) => Promise.reject(t));
          return r.json();
        })
        .then((data) => {
          console.log("[百炼STT] 响应数据:", JSON.stringify(data).substring(0, 500));
          if (data.text) {
            this.lastSTT = data.text;
          } else {
            this.lastSTT = "[错误：语音识别无结果]";
          }
        })
        .catch((err) => {
          console.error("[百炼STT] 错误:", err);
          this.lastSTT = `[识别失败：${err}]`;
        })
        .finally(() => this._emit("whenSTTReceived"));
    }

    getSTT() {
      return this.lastSTT;
    }

    // ============ 语音合成 (TTS) ============

    whenTTSReady() {}

    speak(args) {
      const apiKey = args.KEY.trim();
      const text = args.TEXT;

      if (!apiKey) {
        this.lastReply = "[错误：API Key 为空]";
        return;
      }
      if (!text) return;

      const body = {
        model: "cosyvoice-v3.5-flash",
        input: { text: text },
        parameters: {
          voice: "longxiaochun",
          format: "mp3",
        },
      };

      Scratch.fetch(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/generation",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-DashScope-DataInspection": "enable",
          },
          body: JSON.stringify(body),
        }
      )
        .then((r) => {
          if (!r.ok) return r.text().then((t) => Promise.reject(t));
          return r.arrayBuffer();
        })
        .then((buffer) => {
          this._ttsBuffer = buffer;
          this._emit("whenTTSReady");
        })
        .catch((err) => {
          console.error("[百炼TTS] 合成失败:", err);
        });
    }

    playTTS() {
      if (!this._ttsBuffer) return;

      this.stopTTS();

      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      this.audioCtx
        .decodeAudioData(this._ttsBuffer.slice(0))
        .then((audioBuffer) => {
          const source = this.audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          this.currentAudio = source;
        })
        .catch((err) => {
          console.error("[百炼TTS] 播放失败:", err);
        });
    }

    stopTTS() {
      if (this.currentAudio) {
        try {
          this.currentAudio.stop();
        } catch (_) {}
        this.currentAudio = null;
      }
    }

    // ============ 工具方法 ============

    _emit(opcode) {
      Scratch.vm.runtime.startHats(`dashscopeAI_${opcode}`);
    }
  }

  Scratch.extensions.register(new DashscopeAI());
})(Scratch);
