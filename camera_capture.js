class CameraCaptureExtension {
  constructor(runtime) {
    this.runtime = runtime;
    this.videoElement = null;
  }

  getInfo() {
    return {
      id: 'cameraCapture',
      name: '摄像头截图',
      blocks: [
        {
          opcode: 'captureFrame',
          blockType: Scratch.BlockType.COMMAND,
          text: '捕获当前帧',
        },
        {
          opcode: 'saveFrame',
          blockType: Scratch.BlockType.COMMAND,
          text: '保存帧为 [FILENAME]',
          arguments: {
            FILENAME: {
              type: Scratch.ArgumentType.STRING,
              defaultValue: 'capture.png'
            }
          }
        }
      ],
    };
  }

  captureFrame() {
    const video = this.runtime.ioDevices.video.videoElement;
    if (video) {
      this.videoElement = video;
    }
  }

  saveFrame(args) {
    if (this.videoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.width;
      canvas.height = this.videoElement.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      
      const filename = args.FILENAME;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

Scratch.extensions.register(new CameraCaptureExtension());