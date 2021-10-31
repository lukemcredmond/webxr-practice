import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import LoadingBar from "./utils/LoadingBar";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory";
import WebXRScene from "./utils/WebXRScene";
import { VRButton } from "./utils/VRButton";
import { GazeController } from "./utils/GazeController";
import {
  Constants as MotionControllerConstants,
  fetchProfile,
  MotionController,
} from "@webxr-input-profiles/motion-controllers/dist/motion-controllers.module.js";
import { CanvasUI } from "./utils/CanvasUI";

const DEFAULT_PROFILES_PATH =
  "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles";
const DEFAULT_PROFILE = "generic-trigger";
class App {
  xrScene: WebXRScene;
  currentHandModel: any; //{ left: number; right: number } | undefined;
  handModels: any; //{ left: any; right: any } | undefined;
  hand1: THREE.Group | undefined;
  hand2: THREE.Group | undefined;
  dolly: THREE.Object3D<THREE.Event> | undefined;
  dummyCam: THREE.Object3D<THREE.Event> | undefined;
  colliders: never[] | undefined;
  userData: any;
  useGaze: boolean | undefined;
  gazeController: GazeController | undefined;
  controllers: any;
  immersive: boolean | undefined;
  boardData: any;
  proxy: any | undefined;
  assetsPath: string;
  loadingBar: LoadingBar | undefined;
  joystick: JoyStick | undefined;
  gamepadIndices: any = {};
  buttonStates: any = {};
  room: THREE.Object3D<THREE.Event> | undefined;
  elapsedTime: any | undefined;
  strStates: string | undefined;
  ui: any;
  CanvasMessage: any;

  constructor() {
    const container = document.createElement("div");
    this.CanvasMessage = "";
    document.body.appendChild(container);

    this.assetsPath = "../assets/waiting_room/";

    const rendererParms = { antialias: true };
    const floorGeometry = new THREE.PlaneGeometry(4, 4);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    const ambient = new THREE.HemisphereLight(0x808080, 0x606060);

    const light = new THREE.DirectionalLight();
    light.position.set(0.2, 1, 1);
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = -2;
    light.shadow.camera.right = 2;
    light.shadow.camera.left = -2;
    light.shadow.mapSize.set(4096, 4096);
    const sceneItems: THREE.Object3D[] = [floor, ambient, light];

    this.xrScene = new WebXRScene(
      container,
      rendererParms,
      sceneItems,
      new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.01,
        500
      )
    );
    this.xrScene.Camera.position.set(0, 1.6, 0); //cannot be over written

    const axesHelper = new THREE.AxesHelper(5);
    this.xrScene.Scene.add(axesHelper);

    this.AddDolly();
    this.InitScene();
  }

  private AddDolly() {
    this.dolly = new THREE.Object3D();
    this.dolly.position.set(0, 1, 10);
    this.dolly.add(this.xrScene.Camera);
    this.dummyCam = new THREE.Object3D();

    this.xrScene.Camera.add(this.dummyCam);
    this.xrScene.Scene.add(this.dolly);
  }

  InitScene() {
    const self = this;
    self.loadingBar = new LoadingBar();
    self.loadScene();
    self.xrScene.Renderer.setAnimationLoop(self.Render.bind(self)); //(timestamp, frame) => { self.render(timestamp, frame); } );
  }
  loadScene() {
    const self = this;
    const loader = new GLTFLoader().setPath(self.assetsPath);
    loader.load(
      // resource URL
      "scene.gltf",
      // called when the resource is loaded
      function (gltf) {
        self.room = gltf.scene.children[0];

        self.room.traverse(function (child: any) {
          if (child.isMesh) {
            console.log(child.name);
          }
        });

        self.proxy = self.room;

        self.xrScene.Scene.add(self.room);
        if (self.loadingBar) self.loadingBar.visible = false;

        self.SetupXR();
      },
      // called while loading is progressing
      function (xhr) {
        if (self.loadingBar) self.loadingBar.progress = xhr.loaded / xhr.total;
      },
      // called when loading has errors
      function (error) {
        console.log("An error happened");
      }
    );
  }

  SetupXR() {
    const self = this;
    self.xrScene.Renderer.xr.enabled = true;

    function vrStatus(available: any) {
      if (available) {
        //if cannot connect to controllers init Gaze controller
        const timeoutId = setTimeout(connectionTimeout, 2000);

        function onConnected(event: any, controller: any) {
          clearTimeout(timeoutId);
          const info = {
            name: "",
            targetRayMode: "",
          };
          fetchProfile(event.data, DEFAULT_PROFILES_PATH, DEFAULT_PROFILE).then(
            ({ profile, assetPath }: any) => {
              console.log(JSON.stringify(profile));

              info.name = profile.profileId;
              info.targetRayMode = event.data.targetRayMode;

              //Object.entries(profile.layouts).forEach(([key, layout]: any) => {
              controller.handname = event.data.handedness;
              const key = controller.handname;
              const layout = profile.layouts[key];
              const components = {};
              Object.values(layout.components).forEach((component: any) => {
                (components as any)[component.rootNodeName] =
                  component.gamepadIndices;
              });
              (info as any)[key] = components;
              self.createButtonStates((info as any)[key], key);
              //});

              console.log(JSON.stringify(info));

              self.updateController(info, controller);
            }
          );
        }
        function onDisconnected(obj: any) {
          const controller = obj.controller;
          const grip = obj.grip;
          const index = controller.userData.index;
          console.log(`Disconnected controller ${index}`);
          if (obj.controller) {
            while (controller.children.length > 0)
              controller.remove(controller.children[0]);
            self.dolly?.remove(controller);
          }

          if (obj.grip) self.dolly?.remove(grip);
        }

        function connectionTimeout() {
          self.useGaze = true;
          self.gazeController = new GazeController(
            self.xrScene.Scene,
            self.dummyCam
          );
        }

        self.controllers = self.buildControllers(self.dolly);

        self.controllers.forEach((obj: any) => {
          const controller = obj.controller;
          controller.addEventListener("connected", (event: any) => {
            onConnected(event, controller);
          });
          controller.addEventListener("disconnected", () => {
            onDisconnected(obj);
          });
        });
      } else {
        // self.joystick = new JoyStick({
        //   onMove: self.onMove.bind(self),
        // });
      }
    }
    const button = new VRButton(this.xrScene.Renderer, { vrStatus });
    this.ui = this.createUI();
  }
  createUI(): any {
    const self = this;
    const config = {
      panelSize: { height: 0.5 },
      height: 256,
      body: { type: "text", fontSize: 20 },
    };
    const ui = new CanvasUI({ body: "" }, config);
    ui.mesh.position.set(0, 1.5, -1);
    if (self.dolly) self.dolly.add(ui.mesh);
    //this.xrScene.Scene.add(ui.mesh);
    return ui;
  }
  updateController(info: any, controller: any) {
    const self = this;

    let trigger = false,
      squeeze = false;
    Object.keys(info[controller.handname]).forEach((key) => {
      if (key.indexOf("trigger") != -1) trigger = true;
      if (key.indexOf("squeeze") != -1) squeeze = true;
    });

    if (trigger) {
      controller.addEventListener("selectstart", () => {
        controller.userData.selectPressed = true;
      });
      controller.addEventListener("selectend", () => {
        controller.children[0].scale.z = 0;
        controller.userData.selectPressed = false;
        controller.userData.selected = undefined;
      });
    }
    if (squeeze) {
      controller.addEventListener("squeezestart", () => {
        controller.userData.squeezePressed = true;
        if (controller.userData.selected !== undefined) {
          controller.attach(controller.userData.selected);
          controller.userData.attachedObject = controller.userData.selected;
        }
      });
      controller.addEventListener("squeezeend", () => {
        controller.userData.squeezePressed = false;
        if (controller.userData.attachedObject !== undefined) {
          if (self.room) self.room.attach(this.userData.attachedObject);
          controller.userData.attachedObject = undefined;
        }
      });
    }

    //self.controllers.forEach((obj: any) => {});
  }

  //{"trigger":{"button":0},"touchpad":{"button":2,"xAxis":0,"yAxis":1}},"squeeze":{"button":1},"thumbstick":{"button":3,"xAxis":2,"yAxis":3},"button":{"button":6}}}

  //this.buttonStates[handname][key].xAxis = gamepad.axes[xAxisIndex].toFixed(2);
  //this.buttonStates["right"][]
  //this.buttonStates[handname][key].yAxis =gamepad.axes[yAxisIndex].toFixed(2);

  // Rotate camera Fps style
  rotateCamera(dx: any, dy: any) {
    if (this === undefined) return;
    if (this.dolly === undefined) return;


    console.log(this.dolly.rotation);

    let cleanx = parseFloat(dx);
    let cleany = parseFloat(dy);
    //store previous x rotation
    var x = this.dolly.rotation.x;
    var y = this.dolly.rotation.y;

    //reset camera's x rotation.
    //this.dolly.rotateX(-x);
    //this.dolly.rotateY(-y);

    //rotate camera on y axis
    //this.dolly.rotateY(y+cleany);

    //check if we are trying to look to high or too low
    if (Math.abs(cleanx + x) > Math.PI / 2 - 0.05) 
      this.dolly.rotateX(x);
    else 
      this.dolly.rotateX(x + cleanx);

    //if (Math.abs(cleany + y) > Math.PI / 2 - 0.05) 
      this.dolly.rotateY(y);
    //else 
     // this.dolly.rotateY(y + cleany);

    //reset z rotation. Floating point operations might change z rotation during the above operations.
    this.dolly.rotation.z = 0;

    console.log(this.dolly.rotation);
  }

  handleController(controllers: any) {
    if (this.proxy === undefined) return;
    if (this.dolly === undefined) return;
    if (this.dummyCam === undefined) return;
    if (this.xrScene.workingQuaternion === undefined) return;
    if (this.xrScene.raycaster === undefined) return;
    if (this.buttonStates === undefined) return;
    if (this.buttonStates["left"] === undefined) return;

    const wallLimit = 1.3;
    const speed = 0.2;

    let zdir = 0;
    let xdir = 0;

    let lookside = 0;
    let lookup = 0;

    Object.keys(this.buttonStates["left"]).forEach((key) => {
      if (key.indexOf("touchpad") != -1 || key.indexOf("thumbstick") != -1) {
        xdir = parseFloat(this.buttonStates["left"][key]["xAxis"]);
        zdir = parseFloat(this.buttonStates["left"][key]["yAxis"]);
      }
    });

    Object.keys(this.buttonStates["right"]).forEach((key) => {
      if (key.indexOf("touchpad") != -1 || key.indexOf("thumbstick") != -1) {
        lookside = parseFloat(this.buttonStates["right"][key]["xAxis"]);
        lookup = parseFloat(this.buttonStates["right"][key]["yAxis"]);
      }
    });
    

    let pos = this.dolly.position.clone();
    pos.y += 1;

    let dir = new THREE.Vector3();
    //Store original dolly rotation
    const quaternion = this.dolly.quaternion.clone();
    //Get rotation for movement from the headset pose
    this.dolly.quaternion.copy(
      this.dummyCam.getWorldQuaternion(this.xrScene.workingQuaternion)
    );
    this.dolly.getWorldDirection(dir);
    dir.negate();
    this.xrScene.raycaster.set(pos, dir);

    let blocked = false;

    let intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    // if (intersect.length > 0) {
    //   if (intersect[0].distance < wallLimit) blocked = true;
    // }

    if (!blocked) {
      this.dolly.translateZ(zdir * speed);
      this.dolly.translateX(xdir * speed);
      this.dolly.position.y = 1;
      pos = this.dolly.getWorldPosition(this.xrScene.origin);
    }

    
      

    //cast left
    dir.set(-1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.xrScene.raycaster.set(pos, dir);

    intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(wallLimit - intersect[0].distance);
    }

    //cast right
    dir.set(1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.xrScene.raycaster.set(pos, dir);

    intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(intersect[0].distance - wallLimit);
    }

    //cast down
    //dir.set(0, -1, 0);
    //pos.y += 1.5;
    //this.xrScene.raycaster.set(pos, dir);

    //intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    //if (intersect.length > 0) {
    //  this.dolly.position.copy(intersect[0].point);
    //}

    //Restore the original rotation
    this.dolly.quaternion.copy(quaternion);
    this.rotateCamera(lookup,lookside);
    this.CanvasMessage = { p: this.dolly.position, r : this.dolly.rotation};
  }
  updateGamepadState() {
    const session = this.xrScene.Renderer.xr.getSession();
    if (session) {
      for (let i = 0; i <= 1; i++) {
        const inputSource = session.inputSources[i];
        //console.log("-------------------------------------------");
        //console.log(inputSource);
        const handname = inputSource.handedness;
        if (
          inputSource &&
          inputSource.gamepad &&
          this.gamepadIndices &&
          this.buttonStates
        ) {
          const gamepad = inputSource.gamepad;
          try {
            Object.entries(this.buttonStates[handname]).forEach(
              ([key, value]) => {
                const buttonIndex = this.gamepadIndices[handname][key].button;
                if (
                  key.indexOf("touchpad") != -1 ||
                  key.indexOf("thumbstick") != -1
                ) {
                  const xAxisIndex = this.gamepadIndices[handname][key].xAxis;
                  const yAxisIndex = this.gamepadIndices[handname][key].yAxis;
                  this.buttonStates[handname][key].button =
                    gamepad.buttons[buttonIndex].value;
                  this.buttonStates[handname][key].xAxis =
                    gamepad.axes[xAxisIndex].toFixed(2);
                  this.buttonStates[handname][key].yAxis =
                    gamepad.axes[yAxisIndex].toFixed(2);
                } else {
                  this.buttonStates[handname][key] =
                    gamepad.buttons[buttonIndex].value;
                }
              }
            );
          } catch (e) {
            //console.warn("An error occurred setting the ui");
            console.log(e);
          }
        }
      }
      //console.log(this.buttonStates);
      this.updateUI();
    }
  }
  updateUI() {
    const str = "";//JSON.stringify(this.buttonStates);
    const message = JSON.stringify(this.CanvasMessage);
    if (this.strStates === undefined || str != this.strStates) {
      this.ui.updateElement("body", str + message);
      this.ui.update();
      this.strStates = str + message;
    }
  }
  createButtonStates(components: any, hand: string) {
    const buttonStates = {};
    this.gamepadIndices[hand] = components;

    Object.keys(components).forEach((key) => {
      if (key.indexOf("touchpad") != -1 || key.indexOf("thumbstick") != -1) {
        (buttonStates as any)[key] = { button: 0, xAxis: 0, yAxis: 0 };
      } else {
        (buttonStates as any)[key] = 0;
      }
    });

    this.buttonStates[hand] = buttonStates;
  }
  onMove(forward: any, turn: any) {
    if (this.dolly) {
      this.dolly.userData.forward = forward;
      this.dolly.userData.turn = -turn;
    }
  }

  buildControllers(dolly: THREE.Object3D<THREE.Event> | undefined): any {
    const self = this;
    const controllers = [];
    if (dolly) {
      const controllerModelFactory = new XRControllerModelFactory();

      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);

      const line = new THREE.Line(geometry);
      line.scale.z = 0;

      for (let i = 0; i <= 1; i++) {
        const controller = self.xrScene.Renderer.xr.getController(i);
        (controller as any).handname = "";
        controller.add(line.clone());
        controller.userData.index = i;
        controller.userData.selectPressed = false;
        controller.userData.squeezePressed = false;
        dolly.add(controller);

        const grip = self.xrScene.Renderer.xr.getControllerGrip(i);
        grip.add(controllerModelFactory.createControllerModel(grip));
        dolly.add(grip);
        controllers.push({ controller, grip });
      }

      const handModelFactory = new XRHandModelFactory().setPath("../assets/");
      this.handModels = {
        left: null,
        right: null,
      };
      this.currentHandModel = {
        left: 0,
        right: 0,
      };
      for (let i = 0; i <= 1; i++) {
        let handname = i == 0 ? "right" : "left";
        const hand = self.xrScene.Renderer.xr.getHand(i);
        dolly.add(hand);
        this.handModels[handname] = [
          handModelFactory.createHandModel(hand, "boxes"),
          handModelFactory.createHandModel(hand, "spheres"),
          handModelFactory.createHandModel(hand, "oculus", {
            model: "lowpoly",
          } as any),
          handModelFactory.createHandModel(hand, "oculus"),
        ];

        this.handModels[handname].forEach(
          (model: THREE.Object3D<THREE.Event>) => {
            model.visible = false;
            hand.add(model);
          }
        );

        this.handModels.right[this.currentHandModel.right].visible = true;

        hand.addEventListener("pinchend", (evt) => {
          self.cycleHandModel(evt.handedness);
        });
      }
    }
    return controllers;
  }
  cycleHandModel(hand: any) {
    this.handModels[hand][this.currentHandModel[hand]].visible = false;
    this.currentHandModel[hand] =
      (this.currentHandModel[hand] + 1) % this.handModels[hand].length;
    this.handModels[hand][this.currentHandModel[hand]].visible = true;
  }

  moveDolly(dt: number) {
    if (this.proxy === undefined) return;
    if (this.dolly === undefined) return;
    if (this.dummyCam === undefined) return;
    if (this.xrScene.workingQuaternion === undefined) return;
    if (this.xrScene.raycaster === undefined) return;

    const wallLimit = 1.3;
    const speed = 2;
    let pos = this.dolly.position.clone();
    pos.y += 1;

    let dir = new THREE.Vector3();
    //Store original dolly rotation
    const quaternion = this.dolly.quaternion.clone();
    //Get rotation for movement from the headset pose
    this.dolly.quaternion.copy(
      this.dummyCam.getWorldQuaternion(this.xrScene.workingQuaternion)
    );
    this.dolly.getWorldDirection(dir);
    dir.negate();
    this.xrScene.raycaster.set(pos, dir);

    let blocked = false;

    let intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit) blocked = true;
    }

    if (!blocked) {
      this.dolly.translateZ(-dt * speed);
      pos = this.dolly.getWorldPosition(this.xrScene.origin);
    }

    //cast left
    dir.set(-1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.xrScene.raycaster.set(pos, dir);

    intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(wallLimit - intersect[0].distance);
    }

    //cast right
    dir.set(1, 0, 0);
    dir.applyMatrix4(this.dolly.matrix);
    dir.normalize();
    this.xrScene.raycaster.set(pos, dir);

    intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      if (intersect[0].distance < wallLimit)
        this.dolly.translateX(intersect[0].distance - wallLimit);
    }

    //cast down
    dir.set(0, -1, 0);
    pos.y += 1.5;
    this.xrScene.raycaster.set(pos, dir);

    intersect = this.xrScene.raycaster.intersectObject(this.proxy);
    if (intersect.length > 0) {
      this.dolly.position.copy(intersect[0].point);
    }

    //Restore the original rotation
    this.dolly.quaternion.copy(quaternion);
  }

  get selectPressed() {
    return (
      this.controllers !== undefined &&
      (this.controllers[0].controller.userData.selectPressed ||
        this.controllers[1].controller.userData.selectPressed)
    );
  }

  Render(timestamp: any, frame: any) {
    const dt = this.xrScene.Clock.getDelta();
    const self = this;
    if (this.xrScene.Renderer.xr.isPresenting) {
      let moveGaze = false;
      if (this.dolly) {
        // if (this.useGaze && this.gazeController !== undefined) {
        //   this.gazeController.update();
        //   moveGaze = this.gazeController.mode == GazeController.Modes.MOVE;
        //   if (moveGaze) {
        //     this.moveDolly(dt);
        //   }
        // }

        if (this.elapsedTime === undefined) this.elapsedTime = 0;
        this.elapsedTime += dt;
        if (this.elapsedTime > 0.3) {
          this.updateGamepadState();
          this.elapsedTime = 0;
        }

        if (this.controllers) {
          self.handleController(this.controllers);
        }
      }
    }

    if (this.immersive != this.xrScene.Renderer.xr.isPresenting) {
      this.xrScene.ResizeHandler();
      this.immersive = this.xrScene.Renderer.xr.isPresenting;
    }
    this.xrScene.Renderer.render(this.xrScene.Scene, this.xrScene.Camera);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const app = new App();
  (window as any).app = app;
});

/* buildControllers(parent = this.xrScene.Scene){
  const self = this;
  this.controller1 = this.xrScene.Renderer.xr.getController(0);
  //this.controller1.addEventListener( 'select', onSelect );
  parent.add(this.controller1);

  this.controller2 = this.xrScene.Renderer.xr.getController(1);
  parent.add(this.controller2);

  const controllerModelFactory = new XRControllerModelFactory();

  this.controllerGrip1 = this.xrScene.Renderer.xr.getControllerGrip(0);
  this.controllerGrip1.add(
    controllerModelFactory.createControllerModel(this.controllerGrip1)
  );
  parent.add(this.controllerGrip1);

  this.controllerGrip2 = this.xrScene.Renderer.xr.getControllerGrip(1);
  this.controllerGrip2.add(
    controllerModelFactory.createControllerModel(this.controllerGrip2)
  );
  parent.add(this.controllerGrip2);

  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);

  const line = new THREE.Line(geometry);
  line.name = "line";
  line.scale.z = 5;

  this.controller1.add(line.clone());
  this.controller2.add(line.clone());

  //Hands
  const handModelFactory = new XRHandModelFactory().setPath("../../assets/");

  this.handModels = {
    left: null,
    right: null,
  };

  this.currentHandModel = {
    left: 0,
    right: 0,
  };

  // Hand 1
  this.hand1 = this.xrScene.Renderer.xr.getHand(0);
  parent.add(this.hand1);

  this.handModels.right = [
    handModelFactory.createHandModel(this.hand1, "boxes"),
    handModelFactory.createHandModel(this.hand1, "spheres"),
    //handModelFactory.createHandModel( this.hand1, "oculus", { model: "lowpoly" } ),
    handModelFactory.createHandModel(this.hand1, "oculus"),
  ];

  this.handModels.right.forEach((model: THREE.Object3D<THREE.Event>) => {
    model.visible = false;
    if (this.hand1) this.hand1.add(model);
  });

  

  this.handModels.right[this.currentHandModel.right].visible = true;
  this.hand1.addEventListener("pinchend", (evt) => {
    self.cycleHandModel(evt.handedness);
  });

  // Hand 2
  this.hand2 = this.xrScene.Renderer.xr.getHand(1);
  parent.add(this.hand2);

  this.handModels.left = [
    handModelFactory.createHandModel(this.hand2, "boxes"),
    handModelFactory.createHandModel(this.hand2, "spheres"),
    //handModelFactory.createHandModel( this.hand2, "oculus", { model: "lowpoly" } ),
    handModelFactory.createHandModel(this.hand2, "oculus"),
  ];

  this.handModels.left.forEach((model: THREE.Object3D<THREE.Event>) => {
    model.visible = false;
    if (this.hand2) this.hand2.add(model);
  });

  this.handModels.left[this.currentHandModel.left].visible = true;

  this.hand2.addEventListener("pinchend", (evt) => {
    self.cycleHandModel(evt.handedness);
  });
}

createButtonStates(components){

  const buttonStates:any = {};
  this.gamepadIndices = components;
  
  Object.keys( components ).forEach( (key) => {
      if ( key.indexOf('touchpad')!=-1 || key.indexOf('thumbstick')!=-1){
          buttonStates[key] = { button: 0, xAxis: 0, yAxis: 0 };
      }else{
          buttonStates[key] = 0; 
      }
  })
  
  this.buttonStates = buttonStates;
}

cycleHandModel(hand:string) {
  if(this.handModels){
    this.handModels[ hand ][ this.currentHandModel[ hand ] ].visible = false;
      this.currentHandModel[ hand ] = ( this.currentHandModel[ hand ] + 1 ) % this.handModels[ hand ].length;
      this.handModels[ hand ][ this.currentHandModel[ hand ] ].visible = true;
  }
} */
