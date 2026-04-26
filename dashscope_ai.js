// Name: 百炼大模型
// ID: dashscopeAI
// Description: 调用阿里百炼大模型 API（通义千问），支持文字对话、图片理解、语音识别、语音合成
// License: MIT

(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("百炼大模型扩展必须在非沙箱模式下运行。");
  }

  class DashscopeAI {
    constructor() {
      this.lastReply = "";
      this.lastVisionReply = "";
      this.lastCameraFrameDataUrl = "";
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
          // --- 图片理解 / 摄像头 ---
          {
            opcode: "whenVisionReplyReceived",
            blockType: Scratch.BlockType.EVENT,
            text: "当图片理解完成时",
            isEdgeActivated: false,
          },
          {
            opcode: "saveCameraFrame",
            blockType: Scratch.BlockType.COMMAND,
            text: "保存摄像头画面为 [FILENAME]",
            arguments: {
              FILENAME: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "capture.png",
              },
            },
          },
          {
            opcode: "askWithCameraFrame",
            blockType: Scratch.BlockType.COMMAND,
            text: "使用 API Key [KEY] 向视觉模型 [MODEL] 发送摄像头画面并提问 [PROMPT]",
            arguments: {
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
              MODEL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "qwen3.6-flash",
              },
              PROMPT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "请描述这张图片里的内容。",
              },
            },
          },
          {
            opcode: "askWithSavedCameraFrame",
            blockType: Scratch.BlockType.COMMAND,
            text: "使用 API Key [KEY] 向视觉模型 [MODEL] 发送最近一次保存的图片并提问 [PROMPT]",
            arguments: {
              KEY: { type: Scratch.ArgumentType.STRING, defaultValue: "" },
              MODEL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "qwen3.6-flash",
              },
              PROMPT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "请描述刚才保存的图片内容。",
              },
            },
          },
          {
            opcode: "getVisionReply",
            blockType: Scratch.BlockType.REPORTER,
            text: "图片理解结果",
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

      this._requestChatCompletion(apiKey, body)
        .then((r) => {
          this.lastReply = this._extractMessageText(r) || "[错误：API 未返回有效回复]";
        })
        .catch((err) => {
          this.lastReply = `[请求失败：${err}]`;
        })
        .finally(() => this._emit("whenReplyReceived"));
    }

    getReply() {
      return this.lastReply;
    }

    // ============ 图片理解 / 摄像头 ============

    whenVisionReplyReceived() {}

    saveCameraFrame(args) {
      let frameDataUrl;

      try {
        frameDataUrl = this._captureAndStoreCameraFrame({
          format: "image/png",
        });
      } catch (err) {
        console.warn("[百炼视觉] 保存摄像头画面失败:", err);
        return;
      }

      const filename = args.FILENAME || "capture.png";
      Promise.resolve(Scratch.download(frameDataUrl, filename))
        .then(() => {
          console.log("[百炼视觉] 摄像头画面已保存:", filename);
        })
        .catch((err) => {
          console.error("[百炼视觉] 保存摄像头画面失败:", err);
        });
    }

    askWithCameraFrame(args) {
      const apiKey = args.KEY.trim();
      const model = args.MODEL.trim();
      const prompt = args.PROMPT;

      if (!apiKey) {
        this.lastVisionReply = "[错误：API Key 为空]";
        this._emit("whenVisionReplyReceived");
        return;
      }

      try {
        const imageDataUrl = this._captureAndStoreCameraFrame({
          format: "image/jpeg",
          quality: 0.85,
          maxDimension: 1024,
        });
        this._requestVision(apiKey, model, prompt, imageDataUrl)
          .finally(() => this._emit("whenVisionReplyReceived"));
      } catch (err) {
        this.lastVisionReply = `[图片理解失败：${err.message || err}]`;
        this._emit("whenVisionReplyReceived");
      }
    }

    askWithSavedCameraFrame(args) {
      const apiKey = args.KEY.trim();
      const model = args.MODEL.trim();
      const prompt = args.PROMPT;

      if (!apiKey) {
        this.lastVisionReply = "[错误：API Key 为空]";
        this._emit("whenVisionReplyReceived");
        return;
      }

      if (!this.lastCameraFrameDataUrl) {
        this.lastVisionReply = "[错误：还没有可发送的图片，请先保存摄像头画面或先发送一次当前画面]";
        this._emit("whenVisionReplyReceived");
        return;
      }

      this._requestVision(apiKey, model, prompt, this.lastCameraFrameDataUrl)
        .finally(() => this._emit("whenVisionReplyReceived"));
    }

    getVisionReply() {
      return this.lastVisionReply;
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
          const mimeType = this._getRecordingMimeType();
          this.mediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
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

        const recordedMimeType =
          this.mediaRecorder.mimeType || this._getRecordingMimeType() || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: recordedMimeType });
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
      const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
      console.log("[百炼STT] ========== 开始发送识别请求 ==========");
      console.log("[百炼STT] URL:", url);
      console.log("[百炼STT] Method: POST");
      console.log("[百炼STT] audioBlob size:", audioBlob.size, "type:", audioBlob.type);
      console.log("[百炼STT] model: qwen3-asr-flash");
      console.log("[百炼STT] Authorization: Bearer " + apiKey.substring(0, 8) + "...");

      this._blobToDataUrl(audioBlob)
        .then((dataUrl) => {
          if (dataUrl.length > 10 * 1024 * 1024) {
            throw new Error("录音过大，请将录音控制在约 5 分钟内并尽量简短");
          }

          const body = {
            model: "qwen3-asr-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: {
                      data: dataUrl,
                    },
                  },
                ],
              },
            ],
            stream: false,
            asr_options: {
              enable_itn: false,
            },
          };

          return this._requestChatCompletion(apiKey, body);
        })
        .then((data) => {
          console.log("[百炼STT] 成功响应数据:", JSON.stringify(data));
          const text = this._extractASRText(data);
          if (text) {
            this.lastSTT = text;
            console.log("[百炼STT] 识别结果:", this.lastSTT);
          } else {
            this.lastSTT = "[错误：语音识别无结果]";
            console.warn("[百炼STT] 响应中没有可用识别文本");
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

    _requestChatCompletion(apiKey, body) {
      return Scratch.fetch(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      ).then((r) => {
        if (!r.ok) {
          return r.text().then((t) => Promise.reject(t));
        }
        return r.json();
      });
    }

    _requestVision(apiKey, model, prompt, imageDataUrl) {
      const body = {
        model: model || "qwen3.6-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
              {
                type: "text",
                text: prompt || "请描述这张图片里的内容。",
              },
            ],
          },
        ],
      };

      return this._requestChatCompletion(apiKey, body)
        .then((data) => {
          const text = this._extractMessageText(data);
          this.lastVisionReply = text || "[错误：图片理解无结果]";
        })
        .catch((err) => {
          this.lastVisionReply = `[图片理解失败：${err}]`;
        });
    }

    _getCameraVideo() {
      const runtime = Scratch.vm && Scratch.vm.runtime;
      const provider =
        runtime &&
        runtime.ioDevices.video &&
        runtime.ioDevices.video.provider;
      return provider && provider.video;
    }

    _captureCameraFrame(options) {
      const settings = options || {};
      const video = this._getCameraVideo();

      if (!video || !video.videoWidth || !video.videoHeight) {
        throw new Error("摄像头未开启或不可用");
      }

      const maxDimension = settings.maxDimension || 0;
      const scale =
        maxDimension > 0
          ? Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
          : 1;
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("无法创建画布");
      }

      ctx.drawImage(video, 0, 0, width, height);

      return canvas.toDataURL(
        settings.format || "image/png",
        typeof settings.quality === "number" ? settings.quality : undefined
      );
    }

    _captureAndStoreCameraFrame(options) {
      const dataUrl = this._captureCameraFrame(options);
      this.lastCameraFrameDataUrl = dataUrl;
      return dataUrl;
    }

    _getRecordingMimeType() {
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      if (typeof MediaRecorder === "undefined") return "";
      if (typeof MediaRecorder.isTypeSupported !== "function") return preferredTypes[0];

      return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
    }

    _blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }
          reject(new Error("音频编码失败"));
        };
        reader.onerror = () => reject(reader.error || new Error("音频编码失败"));
        reader.readAsDataURL(blob);
      });
    }

    _extractASRText(data) {
      if (!data || !data.choices || !data.choices.length) return "";
      const message = data.choices[0].message;
      if (!message) return "";
      if (typeof message.content === "string") return message.content;
      if (!Array.isArray(message.content)) return "";

      return message.content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item.text === "string") return item.text;
          return "";
        })
        .join("")
        .trim();
    }

    _extractMessageText(data) {
      if (!data || !data.choices || !data.choices.length) return "";
      const message = data.choices[0].message;
      if (!message) return "";
      if (typeof message.content === "string") return message.content;
      if (!Array.isArray(message.content)) return "";

      return message.content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item.text === "string") return item.text;
          return "";
        })
        .join("")
        .trim();
    }
  }

  Scratch.extensions.register(new DashscopeAI());
})(Scratch);
