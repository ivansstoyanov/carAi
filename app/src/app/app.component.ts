import { Component, OnInit, HostListener } from '@angular/core';
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
  public ctx;
  public labelContainer;
  public maxPredictions;

  public pageHeight: any = 250;
  public pageOrientation: string = 'landscape'; // 'portrait' or 'landscape'

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

    this.socket.on('new-navigation1', (data) => {
console.log('imame novina', data);
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
      this.socket.emit('new-navigation', movement);
    }
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
      this.ctx = canvas.getContext('2d');
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
          this.ctx.drawImage(this.webcam.canvas, 0, 0);
          // draw the keypoints and skeleton
          if (pose) {
              const minPartConfidence = 0.5;
              window.tmPose.drawKeypoints(pose.keypoints, minPartConfidence, this.ctx);
              window.tmPose.drawSkeleton(pose.keypoints, minPartConfidence, this.ctx);
          }
      }
  }
}
