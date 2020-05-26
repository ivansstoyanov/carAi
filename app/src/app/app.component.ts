import { Component } from '@angular/core';
import { Socket } from 'ngx-socket-io';

declare global {
  interface Window { tmPose: any; }
  interface Window { Accelerometer: any; }
}

window.tmPose = window.tmPose || {};
window.Accelerometer = window.Accelerometer || {};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  host: {
    '(window:resize)': 'onResize($event)'
  }
})
export class AppComponent {
  public currentNav: string = 'joystick';
  public loaded: boolean = false;
  public loadedText: string = 'Ready';

  public ctx: any = null;
  public speedGradient: any = null;
  public rpmGradient: any = null;
  public lastSpeedZero: boolean = true;

  public distance: any = [0, 0, 0];
  public elapsedTime: any = [0, 0, 0, 0, 0];

  public sideSettings: boolean = false;
  public carStyle: any = {
    filter: 'contrast(35%) sepia(0%) hue-rotate(0deg)'
  };

  public lastMovement: any = {
    torque: 0,
    turn: 'none'
  };

  public dragPosition = {x: 55, y: 55};
  public currentStates = [] ; // 'active-top' 'active-left';

  public tfmodelUrl = 'assets/my-pose-model/';
  public model;
  public webcam;
  public ctxTf;
  public labelContainer;
  public maxPredictions;

  public pageHeight: any = 250;
  public pageOrientation: string = 'landscape'; // 'portrait' or 'landscape'

  public offset;
  public clock;
  public interval;

  public speedData: any = {
    rps: 0,
    rpm: 0,
    ms: 0,
    kmh: 0
  };
  public movement: any = {
    torque: 0,
    turn: 'none'
  };

  constructor(
    private socket: Socket
  ) {
    this.pageHeight = window.innerHeight;

    this.pageOrientation = window.screen.orientation.type.match(/\w+/)[0];
    window.screen.orientation.onchange = () => {
        this.pageOrientation = window.screen.orientation.type.match(/\w+/)[0];
    };

    setTimeout(() => {
      this.initMotion();
    }, 2000);

    setTimeout(() => {
      this.loadedText = 'GO!!';
    }, 2000);
    setTimeout(() => {
      this.loaded = true;

      this.setSpeedo();
      this.drawSpeedo(0, 0, 0, 15);
    }, 5000);

    this.socket.on('speed', (data) => {
      this.speedData = data;
      this.drawSpeedo(data.kmh, 0, data.rps, 15);
      if (!this.lastSpeedZero && (data.rps === 0)) {
        this.stop();
      }
      else if (this.lastSpeedZero && (data.rps !== 0)) {
        this.start();
      }
      this.lastSpeedZero = data.kmh === 0;
    });
    this.socket.on('distance', (data) => {
      this.distance[0] = Math.floor(data.cm % 10);
      this.distance[1] = Math.floor((data.cm / 10) % 10);
      this.distance[2] = Math.floor((data.cm / 100) % 10);
    });
  }

  onResize(event) {
    this.pageHeight = window.innerHeight;
  }

  colorChange(event) {
    if (event.value > 0) {
      this.carStyle = {
        filter: `contrast(35%) sepia(100%) hue-rotate(${event.value}deg)`
      };
    } else {
      this.carStyle = {
        filter: `contrast(35%) sepia(0%) hue-rotate(0deg)`
      };
    }
  }

  changeNav(nav: string) {
    this.currentNav = nav;
  }

  dragMove(event: any) {
    this.updateStates(event.distance);
  }

  dragStart(event: any) {
  }

  dragEnd(event: any) {
    this.dragPosition = {x: 55, y: 55};
    this.updateStates({ x: 0, y: 0});
    // this.currentState = 'idle';
  }

  updateStates(coords: any) {
    const movement = {
      torque: 0,
      turn: 'none'
    };
// console.log('coords', coords)
    if (coords.x > 25) { movement.turn = 'right'; this.currentStates.push('active-right'); }
    else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-right'); }

    if (coords.x < -25) { movement.turn = 'left'; this.currentStates.push('active-left'); }
    else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-left'); }

    if (coords.y < -9) { movement.torque = this.calculateCarTorque(-9, -60, coords.y, false, true); this.currentStates.push('active-top'); }
    else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-top'); }

    if (coords.y > 12) { movement.torque = this.calculateCarTorque(12, 60, coords.y, false, false); this.currentStates.push('active-bottom'); }
    else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-bottom'); }

    this.executeMovement(movement);
  }


  initMotion() {
    window.addEventListener('deviceorientation', (event) => {
      console.log('wtfff');
      const x = event.beta;  // In degree in the range [-180,180]
      let y = event.gamma; // In degree in the range [-90,90]

      if (this.currentNav === 'motion') {
        const movement = {
          torque: 0,
          turn: 'none'
        };
        if (this.pageOrientation === 'landscape') {
          if (x > 18 && x < 70) { movement.turn = 'right'; this.currentStates.push('active-right'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-right'); }

          if (x < -18 && x > -70) { movement.turn = 'left'; this.currentStates.push('active-left'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-left'); }

          if (y > -77 && y < 0) {
            if (y < -65) { y = -65; } // keep sending 100% torque after overflow
            movement.torque = this.calculateCarTorque(-65, 0, y, false, true); this.currentStates.push('active-top'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-top'); }

          if (y > 10 && y < 75) {
            if (y > 65) { y = 65; } // keep sending 100% torque after overflow
            movement.torque = this.calculateCarTorque(10, 65, y, true, false); this.currentStates.push('active-bottom'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-bottom'); }
        } else {
          if (y > 35 && y < 85) { movement.turn = 'right'; this.currentStates.push('active-right'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-right'); }

          if (y < -35 && y > -85) { movement.turn = 'left'; this.currentStates.push('active-left'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-left'); }

          if (x > 0 && x < 70) {
            if (y > 60) { y = 60; } // keep sending 100% torque after overflow
            movement.torque = this.calculateCarTorque(0, 60, x, true, true); this.currentStates.push('active-top'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-top'); }

          if (x > 96 && x < 160) {
            if (y > 150) { y = 150; } // keep sending 100% torque after overflow
            movement.torque = this.calculateCarTorque(96, 150, x, false, false); this.currentStates.push('active-bottom'); }
          else { this.currentStates = this.currentStates.filter(cs => cs !== 'active-bottom'); }
        }

        this.executeMovement(movement);
      }
    });
  }

  calculateCarTorque(min: number, max: number, current: number, invert: boolean, directionForward: boolean) {
    let res = 100 * (current - min) / (max - min);
    if (invert) { res = 100 - res; }
    if (directionForward && res < 0) { res = -res; }
    if (!directionForward && res > 0) { res = -res; }

    return res;
  }

  executeMovement(movement) {
    if (this.lastMovement.turn !== movement.turn || this.lastMovement.torque !== movement.torque) {
      this.lastMovement.turn = movement.turn;
      this.lastMovement.torque = movement.torque;

      console.log('movement', movement);
      this.movement = movement;
      this.socket.emit('new-navigation', movement);
      this.drawSpeedo(this.speedData.kmh, 0, this.speedData.rps, 15);
    }
  }




  setSpeedo() {
    const c: any = document.getElementById('speed-canvas');
    c.width = 500;
    c.height = 500;

    this.ctx = c.getContext('2d');
    this.ctx.scale(1, 1);

    this.speedGradient = this.ctx.createLinearGradient(0, 500, 0, 0);
    this.speedGradient.addColorStop(0, '#00b8fe');
    this.speedGradient.addColorStop(1, '#41dcf4');

    this.rpmGradient = this.ctx.createLinearGradient(0, 500, 0, 0);
    this.rpmGradient.addColorStop(0, '#f7b733');
    this.rpmGradient.addColorStop(1, '#fc4a1a');
    // rpmGradient.addColorStop(1, '#EF4836');
  }

  speedNeedle(rotation) {
    this.ctx.lineWidth = 2;

    this.ctx.save();
    this.ctx.translate(250, 250);
    this.ctx.rotate(rotation);
    this.ctx.strokeRect(-130 / 2 + 170, -1 / 2, 135, 1);
    this.ctx.restore();

    rotation += Math.PI / 180;
  }

  rpmNeedle(rotation) {
    this.ctx.lineWidth = 2;

    this.ctx.save();
    this.ctx.translate(250, 250);
    this.ctx.rotate(rotation);
    this.ctx.strokeRect(-130 / 2 + 170, -1 / 2, 135, 1);
    this.ctx.restore();

    rotation += Math.PI / 180;
  }

  drawMiniNeedle(rotation, width, speed) {
    this.ctx.lineWidth = width;

    this.ctx.save();
    this.ctx.translate(250, 250);
    this.ctx.rotate(rotation);
    this.ctx.strokeStyle = '#333';
    this.ctx.fillStyle = '#333';
    this.ctx.strokeRect(-20 / 2 + 220, -1 / 2, 20, 1);
    this.ctx.restore();

    const x = (250 + 180 * Math.cos(rotation));
    const y = (250 + 180 * Math.sin(rotation));

    this.ctx.font = '700 20px Open Sans';
    this.ctx.fillText(speed, x, y);

    rotation += Math.PI / 180;
  }

  calculateSpeedAngle(x, a, b) {
    const degree = (a - b) * (x) + b;
    const radian = (degree * Math.PI) / 180;
    return radian <= 1.45 ? radian : 1.45;
  }

  calculateRPMAngel(x, a, b) {
    const degree = (a - b) * (x) + b;
    const radian = (degree * Math.PI) / 180;
    return radian >= -0.46153862656807704 ? radian : -0.46153862656807704;
  }

  drawSpeedo(speed, gear, rpm, topSpeed) {
    if (speed === undefined) {
        return false;
    } else {
        speed = Math.floor(speed);
        rpm = rpm * 10;
    }

    this.ctx.clearRect(0, 0, 500, 500);

    this.ctx.beginPath();
    this.ctx.fillStyle = 'rgba(0, 0, 0, .9)';
    this.ctx.arc(250, 250, 240, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.save();
    this.ctx.restore();
    this.ctx.fillStyle = '#FFF';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 10;
    this.ctx.arc(250, 250, 100, 0, 2 * Math.PI);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.lineWidth = 1;
    this.ctx.arc(250, 250, 240, 0, 2 * Math.PI);
    this.ctx.stroke();

    this.ctx.font = '700 70px Open Sans';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(speed, 250, 220);

    this.ctx.font = '700 15px Open Sans';
    this.ctx.fillText('kmh', 250, 235);

    this.ctx.font = '700 70px Open Sans';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(rpm / 10, 233, 320);

    this.ctx.font = '700 15px Open Sans';
    this.ctx.fillText('rps', 238, 337);

    // if (gear === 0 && speed > 0) {
    //     this.ctx.fillStyle = '#999';
    //     this.ctx.font = '700 70px Open Sans';
    //     this.ctx.fillText('R', 250, 460);

    //     this.ctx.fillStyle = '#333';
    //     this.ctx.font = '50px Open Sans';
    //     this.ctx.fillText('N', 290, 460);
    // } else if (gear === 0 && speed == 0) {
    //     this.ctx.fillStyle = '#999';
    //     this.ctx.font = '700 70px Open Sans';
    //     this.ctx.fillText('N', 250, 460);

    //     this.ctx.fillStyle = '#333';
    //     this.ctx.font = '700 50px Open Sans';
    //     this.ctx.fillText('R', 210, 460);

    //     this.ctx.font = '700 50px Open Sans';
    //     this.ctx.fillText(parseInt(gear) + 1, 290, 460);
    // } else if (gear - 1 <= 0) {
    //     this.ctx.fillStyle = '#999';
    //     this.ctx.font = '700 70px Open Sans';
    //     this.ctx.fillText(gear, 250, 460);

    //     this.ctx.fillStyle = '#333';
    //     this.ctx.font = '50px Open Sans';
    //     this.ctx.fillText('R', 210, 460);

    //     this.ctx.font = '700 50px Open Sans';
    //     this.ctx.fillText(parseInt(gear) + 1, 290, 460);
    // } else {
    //     this.ctx.font = '700 70px Open Sans';
    //     this.ctx.fillStyle = '#999';
    //     this.ctx.fillText(gear, 250, 460);

    //     this.ctx.font = '700 50px Open Sans';
    //     this.ctx.fillStyle = '#333';
    //     this.ctx.fillText(gear - 1, 210, 460);
    //     if (parseInt(gear) + 1 < 7) {
    //         this.ctx.font = '700 50px Open Sans';
    //         this.ctx.fillText(parseInt(gear) + 1, 290, 460);
    //     }
    // }

    this.ctx.fillStyle = '#FFF';
    for (let i = 10; i <= 110; i += 10) { // Math.ceil(topSpeed / 20) * 20
        this.drawMiniNeedle(this.calculateSpeedAngle(i / 100, 83.07888, 34.3775) *
          Math.PI, i % 20 === 0 ? 3 : 1, i % 20 === 0 ? i / 5 : '');

        if (i <= 100) {
            this.drawMiniNeedle(this.calculateSpeedAngle(i / 47, 0, 22.9183) *
              Math.PI, i % 20 === 0 ? 3 : 1, i % 20 === 0 ? `${i}%` : '');
        }
    }

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#41dcf4';
    this.ctx.lineWidth = 25;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#00c6ff';

    this.ctx.strokeStyle = this.speedGradient;
    this.ctx.arc(250, 250, 228, .6 * Math.PI, this.calculateSpeedAngle(speed / topSpeed, 83.07888, 34.3775) * Math.PI);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.lineWidth = 25;
    this.ctx.strokeStyle = this.rpmGradient;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#f7b733';

    this.ctx.arc(250, 250, 228, .4 * Math.PI,
      this.calculateRPMAngel(+(this.movement.torque / 10).toFixed(0) / 4.7, 0, 22.9183) * Math.PI, true);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = '#41dcf4';
    this.speedNeedle(this.calculateSpeedAngle(speed / topSpeed, 83.07888, 34.3775) * Math.PI);

    this.ctx.strokeStyle = this.rpmGradient;
    this.rpmNeedle(this.calculateRPMAngel(+(this.movement.torque / 10).toFixed(0) / 4.7, 0, 22.9183) * Math.PI);

    this.ctx.strokeStyle = '#000';
  }








  async initTf() {
      const modelURL = this.tfmodelUrl + 'model.json';
      const metadataURL = this.tfmodelUrl + 'metadata.json';

      // load the model and metadata
      // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
      // Note: the pose library adds a tmPose object to your window (window.tmPose)
      this.model = await window.tmPose.load(modelURL, metadataURL);
      this.maxPredictions = this.model.getTotalClasses();

      // Convenience function to setup a webcam
      const size = 200;
      const flip = true; // whether to flip the webcam
      this.webcam = new window.tmPose.Webcam(size, size, flip); // width, height, flip
      await this.webcam.setup(); // request access to the webcam
      await this.webcam.play();
      window.requestAnimationFrame(this.loop.bind(this));

      // append/get elements to the DOM
      const canvas: any = document.getElementById('canvas');
      canvas.width = size;
      canvas.height = size;
      this.ctxTf = canvas.getContext('2d');
      this.labelContainer = document.getElementById('label-container');
      for (let i = 0; i < this.maxPredictions; i++) { // and class labels
          this.labelContainer.appendChild(document.createElement('div'));
      }
  }

  async loop(timestamp) {
      this.webcam.update(); // update the webcam frame
      await this.predict();
      window.requestAnimationFrame(this.loop.bind(this));
  }

  async predict() {
      // Prediction #1: run input through posenet
      // estimatePose can take in an image, video or canvas html element
      const { pose, posenetOutput } = await this.model.estimatePose(this.webcam.canvas);
      // Prediction 2: run input through teachable machine classification model
      const prediction = await this.model.predict(posenetOutput);

      for (let i = 0; i < this.maxPredictions; i++) {
          const classPrediction =
              prediction[i].className + ': ' + prediction[i].probability.toFixed(2);
          this.labelContainer.childNodes[i].innerHTML = classPrediction;
      }

      // finally draw the poses
      this.drawPose(pose);
  }

  drawPose(pose) {
      if (this.webcam.canvas) {
          this.ctxTf.drawImage(this.webcam.canvas, 0, 0);
          // draw the keypoints and skeleton
          if (pose) {
              const minPartConfidence = 0.5;
              window.tmPose.drawKeypoints(pose.keypoints, minPartConfidence, this.ctxTf);
              window.tmPose.drawSkeleton(pose.keypoints, minPartConfidence, this.ctxTf);
          }
      }
  }





  start() {
    if (!this.interval) {
      this.offset = Date.now();
      this.interval = setInterval(() => {
        const now = Date.now();
        const d = now - this.offset;

        this.elapsedTime[0] = Math.floor((d / 10) % 10);
        this.elapsedTime[1] = Math.floor((d / 100) % 10);
        this.elapsedTime[2] = Math.floor((d / 1000) % 10);
        this.elapsedTime[3] = Math.floor((d / 10000) % 10);
        this.elapsedTime[4] = Math.floor((d / 100000) % 10);
      }, 20);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
