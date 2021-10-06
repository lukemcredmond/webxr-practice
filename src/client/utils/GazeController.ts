import * as THREE from "three";
import { RingProgressMesh } from "./RingProgressMesh";

class GazeController {
  static Modes = { HIDDEN: 1, GAZING: 2, MOVE: 3 };
  clock: THREE.Clock | undefined;
  direction: THREE.Vector3 | undefined;
  tmpPos: THREE.Vector3 | undefined;
  vec3: THREE.Vector3 | undefined;
  mat4: THREE.Matrix4 | undefined;
  camera: any | undefined;
  modeTime: number | undefined;
  private _mode: any;
  ring: RingProgressMesh | undefined;

  constructor(scene: THREE.Scene, camera: any) {
    if (scene === undefined) {
      console.warn(
        "GazeController needs a THREE.Scene instance passing to the constructor"
      );
      return;
    }
    if (camera === undefined) {
      console.warn(
        "GazeController needs a THREE.Camera instance passing to the constructor"
      );
      return;
    }
    this.clock = new THREE.Clock();
    this.ring = new RingProgressMesh(0.2);
    this.ring.visible = false;
    this.direction = new THREE.Vector3();
    this.tmpPos = new THREE.Vector3();
    this.vec3 = new THREE.Vector3();
    this.mat4 = new THREE.Matrix4();
    this.camera = camera;
    this.mode = GazeController.Modes.HIDDEN;
    this.ring.position.set(0, 0, -1);
    this.ring.lookAt(this.camera.position);
    camera.add(this.ring);
  }

  set mode(value: any) {
    if (this.clock && this.mat4 && this.camera && this.direction) {
      this.modeTime = this.clock.getElapsedTime();
      this.mat4.identity().extractRotation(this.camera.matrixWorld);
      this.direction.set(0, 0, -1).applyMatrix4(this.mat4);
    }

    this._mode = value;
  }

  get mode() {
    return this._mode;
  }

  update() {
    if (
      !(
        this.clock &&
        this.mat4 &&
        this.camera &&
        this.direction &&
        this.vec3 &&
        this.modeTime
      )
    ) {
      return;
    } else {
      const elapsedTime = this.clock.getElapsedTime() - this.modeTime;
      this.mat4.identity().extractRotation(this.camera.matrixWorld);
      this.vec3.set(0, 0, -1).applyMatrix4(this.mat4);
      const theta = this.vec3.angleTo(this.direction);

      //console.log(`GazeController.update: mode:${this._mode} elapsedTime=${elapsedTime.toFixed(2)} theta:${theta.toFixed(2)}`);
      switch (this._mode) {
        case GazeController.Modes.HIDDEN:
          if (elapsedTime > 1) {
            this.mode = GazeController.Modes.GAZING;
            if (this.ring) this.ring.visible = true;
          } else if (theta > 0.2) {
            //Reset direction and time
            this.mode = GazeController.Modes.HIDDEN;
          }
          break;
        case GazeController.Modes.GAZING:
          if (elapsedTime > 1) {
            this.mode = GazeController.Modes.MOVE;
            if (this.ring) this.ring.visible = false;
          } else if (theta > 0.2) {
            //Reset direction and time
            this.mode = GazeController.Modes.HIDDEN;
            if (this.ring) this.ring.visible = false;
          } else {
            if (this.ring) this.ring.progress = elapsedTime;
          }
          break;
        case GazeController.Modes.MOVE:
          if (theta > 0.2) {
            //Reset direction and time
            this.mode = GazeController.Modes.HIDDEN;
            if (this.ring) this.ring.visible = false;
          }
          break;
      }
    }
  }
}

export { GazeController };
