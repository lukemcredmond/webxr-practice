import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ARButton } from "./utils/ARButton";
import LoadingBar from "./utils/LoadingBar";
import Player from "./utils/Player";
import WebXRScene from "./utils/WebXRScene";

class App {
  public xrScene: WebXRScene;
  Reticle!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
  hitTestSource!: THREE.XRHitTestSource | null;
  hitTestSourceRequested: boolean | undefined;
  controller: THREE.Group | undefined;
  assetsPath: string;
  playerModel: Player | undefined;
  LoadingBar: LoadingBar;
  WorkingVec3: THREE.Vector3;
  referenceSpace: any;
  ModelName: string;
  ModelAnimation: string;
  
  constructor() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const rendererParms = { antialias: true, alpha: true };

    const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2);
    ambient.position.set(0.5, 1, 0.25);
    const light = new THREE.DirectionalLight();
    light.position.set(0.2, 1, 1);

    const sceneItems: THREE.Object3D[] = [ambient, light];
    this.xrScene = new WebXRScene(container, rendererParms, sceneItems);
    this.xrScene.Camera.position.set(0, 1.6, 3); //cannot be over written
    
    this.WorkingVec3 = new THREE.Vector3();
    this.assetsPath = "../assets/";
    this.LoadingBar = new LoadingBar();

    this.ModelName = "knight2.glb";
    this.ModelAnimation = "Dance";


    this.InitScene();
    this.SetupXR();
  }
  InitScene() {
    this.addPointer();

    this.loadModel();
  }
  loadModel() {
    const loader = new GLTFLoader().setPath(this.assetsPath);
    const self = this;

    // Load a GLTF resource
    loader.load(
      // resource URL
      self.ModelName,//`knight2.glb`,
      // called when the resource is loaded
      function (gltf) {
        const object = gltf.scene.children[5];

        const options = {
          object: object,
          speed: 0.5,
          assetsPath: self.assetsPath,
          loader: loader,
          animations: gltf.animations,
          clip: gltf.animations[0],
          app: self,
          name: "knight",
          npc: false,
        };

        self.playerModel = new Player(options);
        self.playerModel.object.visible = false;

        self.playerModel.action = self.ModelAnimation//"Dance";
        const scale = 0.005;
        self.playerModel.object.scale.set(scale, scale, scale);

        self.LoadingBar.visible = false;
        self.xrScene.Renderer.setAnimationLoop(self.Render.bind(self)); //(timestamp, frame) => { self.render(timestamp, frame); } );
      },
      // called while loading is progressing
      function (xhr) {
        self.LoadingBar.progress = xhr.loaded / xhr.total;
      },
      // called when loading has errors
      function (error) {
        console.log("An error happened");
      }
    );
  }
  SetupXR() {
    this.xrScene.Renderer.xr.enabled = true;
    const btn = new ARButton(this.xrScene.Renderer, {
      sessionInit: {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: document.body },
      },
    });

    const self = this;

    this.hitTestSourceRequested = false;
    this.hitTestSource = null;

    function onSelect() {
      if (self.playerModel === undefined) return;
      if (self.Reticle != undefined) {
        if (self.Reticle.visible) {
          if (self.playerModel.object.visible) {
            self.WorkingVec3.setFromMatrixPosition(self.Reticle.matrix);
            self.playerModel.newPath(self.WorkingVec3);
          } else {
            self.playerModel.object.position.setFromMatrixPosition(
              self.Reticle.matrix
            );
            self.playerModel.object.visible = true;
          }
        }
      }
    }
    this.controller = this.xrScene.Renderer.xr.getController(0);
    this.controller.addEventListener("select", onSelect);

    this.xrScene.Scene.add(this.controller);
  }
  addPointer() {
    this.Reticle = new THREE.Mesh(
      new THREE.RingBufferGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );

    this.Reticle.matrixAutoUpdate = false;
    this.Reticle.visible = false;
    this.xrScene.Scene.add(this.Reticle);
  }
  Render() {}

  requestHitTestSource() {
    const self = this;

    const session = this.xrScene.Renderer.xr.getSession();

    if(session != null)
    {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            self.hitTestSource = source;
          });
      });
  
      session.addEventListener("end", function () {
        self.hitTestSourceRequested = false;
        self.hitTestSource = null;
        self.referenceSpace = null;
      });
    }
    

    this.hitTestSourceRequested = true;
  }

  getHitTestResults(frame:any) {
    const hitTestResults = frame.getHitTestResults(this.hitTestSource);

    if(this.Reticle != undefined){
      if (hitTestResults.length) {
        const referenceSpace = this.xrScene.Renderer.xr.getReferenceSpace();
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
  
        this.Reticle.visible = true;
        this.Reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        this.Reticle.visible = false;
      }
    }
    
  }
}

document.addEventListener("DOMContentLoaded", function(){
  const app = new App();
  (window as any).app = app;
});