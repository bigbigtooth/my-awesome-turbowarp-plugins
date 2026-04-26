class CameraCaptureExtension {
  constructor(runtime) {
    this.runtime = runtime;
  }

  getInfo() {
    return {
      id: 'cameraCapture',
      name: '摄像头截图',
      blocks: [
        {
          opcode: 'saveFrame',
          blockType: Scratch.BlockType.COMMAND,
          text: '保存摄像头画面为 [FILENAME]',
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

  _getVideo() {
    const provider = this.runtime.ioDevices.video.provider;
    if (provider && provider.video) {
      return provider.video;
    }
    return null;
  }

  saveFrame(args) {
    const video = this._getVideo();
    if (!video) {
      console.warn('[摄像头截图] 摄像头未开启或不可用');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = args.FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

Scratch.extensions.register(new CameraCaptureExtension());