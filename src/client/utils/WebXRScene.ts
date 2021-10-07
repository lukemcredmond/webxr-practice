import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ARButton } from './ARButton';

export default class WebXRScene
{
    public Camera : THREE.PerspectiveCamera
    public Clock  : THREE.Clock
    public Scene : THREE.Scene
    public Renderer: THREE.WebGLRenderer;
    public Controls: OrbitControls;
    public raycaster: THREE.Raycaster;
    public workingMatrix: THREE.Matrix4;
    public workingVector: THREE.Vector3;
    public origin: THREE.Vector3;
    public workingQuaternion: THREE.Quaternion;
    public up: THREE.Vector3;

    constructor(container: HTMLDivElement, rendererParms:any, 
        sceneItems: THREE.Object3D[], 
        camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 )
        ){

        this.Clock = new THREE.Clock();
        this.Camera = camera;
        
        this.Scene = new THREE.Scene();
        this.Renderer = new THREE.WebGLRenderer(rendererParms);
        this.Renderer.setPixelRatio( window.devicePixelRatio );
        this.Renderer.setSize(window.innerWidth, window.innerHeight)
        this.Renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.Renderer.domElement);


        sceneItems.forEach((item) => this.Scene.add(item));


        this.Controls = new OrbitControls( this.Camera, this.Renderer.domElement );
        this.Controls.target.set(0, 3.5, 0);
        this.Controls.update();

        this.up = new THREE.Vector3(0,1,0);
        this.raycaster = new THREE.Raycaster();
        this.workingMatrix = new THREE.Matrix4();
        this.workingVector = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.origin = new THREE.Vector3();


        window.addEventListener('resize', this.ResizeHandler.bind(this) );
    }

   


   
    public ResizeHandler(){
        this.Camera.aspect = window.innerWidth / window.innerHeight;
    	this.Camera.updateProjectionMatrix();
    	this.Renderer.setSize( window.innerWidth, window.innerHeight ); 
    }
 
    
}