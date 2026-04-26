// Name: 摄像头截图
// ID: cameraCapture
// Description: 从 TurboWarp 摄像头中捕获当前帧并保存为 PNG 图片
// License: MIT

(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("摄像头截图扩展必须在非沙箱模式下运行。");
  }

  class CameraCaptureExtension {
    constructor(runtime) {
      this.runtime = runtime;
    }

    getInfo() {
      return {
        id: "cameraCapture",
        name: "摄像头截图",
        blocks: [
          {
            opcode: "saveFrame",
            blockType: Scratch.BlockType.COMMAND,
            text: "保存摄像头画面为 [FILENAME]",
            arguments: {
              FILENAME: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "capture.png",
              },
            },
          },
        ],
      };
    }

    saveFrame(args) {
      const provider =
        this.runtime.ioDevices.video &&
        this.runtime.ioDevices.video.provider;
      const video = provider && provider.video;

      if (!video || !video.videoWidth) {
        console.warn("[摄像头截图] 摄像头未开启或不可用");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = args.FILENAME || "capture.png";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        "image/png"
      );
    }
  }

  Scratch.extensions.register(new CameraCaptureExtension());
})(Scratch);
