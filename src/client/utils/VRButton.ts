import { XRSession } from 'webxr';
import type { Navigator } from 'webxr';
 import type { XRSystem } from 'webxr';


class VRButton {
	
    private xr : XRSystem|null;
	public button: HTMLButtonElement;
	private renderer : THREE.WebGLRenderer;
    constructor(renderer:THREE.WebGLRenderer, options:any|null = null ){
        this.xr =  (navigator as any)?.xr as XRSystem;
		this.renderer = renderer;
		
		if ( options ) {

			console.error( 'THREE.VRButton: The "options" parameter has been removed. Please set the reference space type via renderer.xr.setReferenceSpaceType() instead.' );

		}

		this.button = document.createElement( 'button' );

		if ( 'xr' in navigator ) {

			this.button.id = 'VRButton';
			this.button.style.display = 'none';

			this.stylizeElement( this.button );

			this.xr.isSessionSupported( 'immersive-vr' ).then( ( supported ) => {

				supported ? this.showEnterVR() : this.showWebXRNotFound();

			} );

			

		} else {

			const message = document.createElement( 'a' );

			if ( window.isSecureContext === false ) {

				message.href = document.location.href.replace( /^http:/, 'https:' );
				message.innerHTML = 'WEBXR NEEDS HTTPS'; // TODO Improve message

			} else {

				message.href = 'https://immersiveweb.dev/';
				message.innerHTML = 'WEBXR NOT AVAILABLE';

			}

			message.style.left = 'calc(50% - 90px)';
			message.style.width = '180px';
			message.style.textDecoration = 'none';

			this.stylizeElement( message );

			//return message;

		}
    }
	static createButton( ) {
	
	}

	showEnterVR( /*device*/ ) {

		let currentSession:XRSession|null = null;
		const self = this;

		async function onSessionStarted( session:any ) {

			session.addEventListener( 'end', onSessionEnded );

			await self.renderer.xr.setSession( session );
			self.button.textContent = 'EXIT VR';

			currentSession = session;

		}

		function onSessionEnded( /*event*/ ) {
			if(currentSession != null)
				currentSession.removeEventListener( 'end', onSessionEnded );

				self.button.textContent = 'ENTER VR';

			currentSession = null;

		}

		//

		self.button.style.display = '';

		self.button.style.cursor = 'pointer';
		self.button.style.left = 'calc(50% - 50px)';
		self.button.style.width = '100px';

		self.button.textContent = 'ENTER VR';

		self.button.onmouseenter = function () {

			self.button.style.opacity = '1.0';

		};

		self.button.onmouseleave = function () {

			self.button.style.opacity = '0.5';

		};

		self.button.onclick = function () {

			if ( currentSession === null ) {

				// WebXR's requestReferenceSpace only works if the corresponding feature
				// was requested at session creation time. For simplicity, just ask for
				// the interesting ones as optional features, but be aware that the
				// requestReferenceSpace call will fail if it turns out to be unavailable.
				// ('local' is always available for immersive sessions and doesn't need to
				// be requested separately.)

				const sessionInit = { optionalFeatures: [ 'local-floor', 'bounded-floor', 'hand-tracking' ] };
				if(self.xr != null)
				self.xr.requestSession( 'immersive-vr', sessionInit ).then( onSessionStarted );

			} else {

				currentSession.end();

			}

		};

	}

	 disableButton() {

		this.button.style.display = '';

		this.button.style.cursor = 'auto';
		this.button.style.left = 'calc(50% - 75px)';
		this.button.style.width = '150px';

		this.button.onmouseenter = null;
		this.button.onmouseleave = null;

		this.button.onclick = null;

	}

	 showWebXRNotFound() {

		this.disableButton();

		this.button.textContent = 'VR NOT SUPPORTED';

	}

	 stylizeElement( element:HTMLElement ) {

		element.style.position = 'absolute';
		element.style.bottom = '20px';
		element.style.padding = '12px 6px';
		element.style.border = '1px solid #fff';
		element.style.borderRadius = '4px';
		element.style.background = 'rgba(0,0,0,0.1)';
		element.style.color = '#fff';
		element.style.font = 'normal 13px sans-serif';
		element.style.textAlign = 'center';
		element.style.opacity = '0.5';
		element.style.outline = 'none';
		element.style.zIndex = '999';

	}

}

export { VRButton };
