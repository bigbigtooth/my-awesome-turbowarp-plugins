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
      console.log("[百炼STT] startRecording 被调用, 当前 isRecording:", this.isRecording);
      if (this.isRecording) return;
      this.audioChunks = [];

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          console.log("[百炼STT] getUserMedia 成功, stream tracks:", stream.getTracks().length);
          this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
          });
          console.log("[百炼STT] MediaRecorder 创建成功, mimeType:", this.mediaRecorder.mimeType);
          this.mediaRecorder.ondataavailable = (e) => {
            console.log("[百炼STT] ondataavailable, chunk size:", e.data.size);
            if (e.data.size > 0) this.audioChunks.push(e.data);
          };
          this.mediaRecorder.start();
          this.isRecording = true;
          console.log("[百炼STT] 录音已开始, state:", this.mediaRecorder.state);
        })
        .catch((err) => {
          console.error("[百炼STT] getUserMedia 失败:", err);
          this.lastSTT = `[录音失败：${err.message}]`;
          this._emit("whenSTTReceived");
        });
    }

    stopRecordingAndRecognize(args) {
      const apiKey = args.KEY.trim();
      console.log("[百炼STT] stopRecordingAndRecognize 被调用");
      console.log("[百炼STT] isRecording:", this.isRecording, "mediaRecorder:", !!this.mediaRecorder, "apiKey长度:", apiKey.length);

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
        console.log("[百炼STT] 录音已停止, audioChunks数量:", this.audioChunks.length);

        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.audioChunks = [];

        console.log("[百炼STT] 音频 Blob 大小:", audioBlob.size, "类型:", audioBlob.type);

        if (audioBlob.size === 0) {
          console.error("[百炼STT] 音频数据为空!");
          this.lastSTT = "[错误：录音数据为空]";
          this._emit("whenSTTReceived");
          return;
        }

        this._callSTT(apiKey, audioBlob);
      };

      console.log("[百炼STT] 调用 mediaRecorder.stop(), 当前 state:", this.mediaRecorder.state);
      this.mediaRecorder.stop();
    }

    _callSTT(apiKey, audioBlob) {
      const formData = new FormData();
      formData.append("model", "paraformer-v2");
      formData.append("file", audioBlob, "recording.webm");

      const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions";
      console.log("[百炼STT] ========== 开始发送识别请求 ==========");
      console.log("[百炼STT] URL:", url);
      console.log("[百炼STT] Method: POST");
      console.log("[百炼STT] audioBlob size:", audioBlob.size, "type:", audioBlob.type);
      console.log("[百炼STT] FormData model: paraformer-v2");
      console.log("[百炼STT] FormData file: recording.webm");
      console.log("[百炼STT] Authorization: Bearer " + apiKey.substring(0, 8) + "...");

      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })
        .then((r) => {
          console.log("[百炼STT] 收到响应, 状态码:", r.status, "状态文本:", r.statusText);
          console.log("[百炼STT] 响应头 Content-Type:", r.headers.get("content-type"));
          if (!r.ok) {
            return r.text().then((t) => {
              console.error("[百炼STT] 错误响应体:", t);
              return Promise.reject(t);
            });
          }
          return r.json();
        })
        .then((data) => {
          console.log("[百炼STT] 成功响应数据:", JSON.stringify(data));
          if (data.text) {
            this.lastSTT = data.text;
            console.log("[百炼STT] 识别结果:", this.lastSTT);
          } else {
            this.lastSTT = "[错误：语音识别无结果]";
            console.warn("[百炼STT] 响应中没有 text 字段");
          }
        })
        .catch((err) => {
          console.error("[百炼STT] 请求失败:", err);
          this.lastSTT = `[识别失败：${err}]`;
        })
        .finally(() => {
          console.log("[百炼STT] ========== 请求结束 ==========");
          this._emit("whenSTTReceived");
        });
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
