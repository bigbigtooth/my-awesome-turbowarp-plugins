// Name: 百炼大模型
// ID: dashscopeAI
// Description: 调用阿里百炼大模型 API（通义千问）进行对话
// License: MIT

(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("百炼大模型扩展必须在非沙箱模式下运行。");
  }

  class DashscopeAI {
    constructor() {
      this.lastReply = "";
    }

    getInfo() {
      return {
        id: "dashscopeAI",
        name: "百炼大模型",
        color1: "#FF6A00",
        color2: "#E55D00",
        color3: "#CC5200",
        blocks: [
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
              KEY: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "",
              },
              MODEL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "qwen-plus",
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
        ],
      };
    }

    whenReplyReceived() {
      // HAT block — triggered by _emitReply
    }

    ask(args) {
      const apiKey = args.KEY.trim();
      const question = args.QUESTION;
      const model = args.MODEL.trim();

      if (!apiKey) {
        this.lastReply = "[错误：API Key 为空]";
        this._emitReply();
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
        .finally(() => {
          this._emitReply();
        });
    }

    getReply() {
      return this.lastReply;
    }

    _emitReply() {
      Scratch.vm.runtime.startHats("dashscopeAI_whenReplyReceived");
    }
  }

  Scratch.extensions.register(new DashscopeAI());
})(Scratch);
