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

    async saveFrame(args) {
      const provider =
        this.runtime.ioDevices.video &&
        this.runtime.ioDevices.video.provider;
      const video = provider && provider.video;

      console.log("[摄像头截图] video:", video, "videoWidth:", video && video.videoWidth);

      if (!video || !video.videoWidth) {
        console.warn("[摄像头截图] 摄像头未开启或不可用");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      console.log("[摄像头截图] canvas:", canvas.width, "x", canvas.height);

      const dataURL = canvas.toDataURL("image/png");
      const filename = args.FILENAME || "capture.png";

      console.log("[摄像头截图] dataURL length:", dataURL.length, "filename:", filename);

      try {
        await Scratch.download(dataURL, filename);
        console.log("[摄像头截图] 下载完成");
      } catch (e) {
        console.error("[摄像头截图] 下载失败:", e);
      }
    }
  }

  Scratch.extensions.register(new CameraCaptureExtension());
})(Scratch);
