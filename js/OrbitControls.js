import {
	EventDispatcher,
	MOUSE,
	Quaternion,
	Spherical,
	TOUCH,
	Vector2,
	Vector3
} from './three.module.js';

class OrbitControls extends EventDispatcher {

	constructor(object, domElement) {

		super();

		this.object = object;
		this.domElement = domElement;

		// API

		// Set to false to disable this control
		this.enabled = true;

		// "target" sets the location of focus, where the object orbits around
		this.target = new Vector3();

		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, the interval [ min, max ] must be a sub-interval of [ -2 PI, 2 PI ],
		// with ( max - min < 2 PI )
		this.minAzimuthAngle = - Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians

		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.05;

		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Set to false to disable panning
		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
		this.keyPanSpeed = 7.0; // pixels moved per arrow key push

		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

		// The four arrow keys
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		// Mouse buttons
		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		// Touch fingers
		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		// Flags
		this._domElementKeyEvents = null;

		// internals

		const scope = this;

		const STATE = {
			NONE: -1,
			ROTATE: 0,
			DOLLY: 1,
			PAN: 2,
			TOUCH_ROTATE: 3,
			TOUCH_DOLLY_PAN: 4
		};

		let state = STATE.NONE;

		const EPS = 0.000001;

		// current position in spherical coordinates
		const spherical = new Spherical();
		const sphericalDelta = new Spherical();

		let scale = 1;
		const panOffset = new Vector3();
		let zoomChanged = false;

		const rotateStart = new Vector2();
		const rotateEnd = new Vector2();
		const rotateDelta = new Vector2();

		const panStart = new Vector2();
		const panEnd = new Vector2();
		const panDelta = new Vector2();

		const dollyStart = new Vector2();
		const dollyEnd = new Vector2();
		const dollyDelta = new Vector2();
		// functions

		function getAutoRotationAngle() {

			return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

		}

		function getZoomScale() {

			return Math.pow(0.95, scope.zoomSpeed);

		}

		function rotateLeft(angle) {

			sphericalDelta.theta -= angle;

		}

		function rotateUp(angle) {

			sphericalDelta.phi -= angle;

		}

		const panLeft = (function () {

			const v = new Vector3();

			return function panLeft(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 0);
				v.multiplyScalar(- distance);

				panOffset.add(v);

			};

		}());

		const panUp = (function () {

			const v = new Vector3();

			return function panUp(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 1);
				v.multiplyScalar(distance);

				panOffset.add(v);

			};

		}());

		// deltaX and deltaY are in pixels; right and down are positive
		const pan = (function () {

			const offset = new Vector3();

			return function pan(deltaX, deltaY) {

				const element = scope.domElement;

				if (scope.object.isPerspectiveCamera) {

					const position = scope.object.position;
					offset.copy(position).sub(scope.target);

					let targetDistance = offset.length();

					targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

					panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
					panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

				} else if (scope.object.isOrthographicCamera) {

					panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix);
					panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix);

				} else {

					console.warn('WARNING: OrbitControls: Unsupported camera type');

				}

			};

		}());

		function dollyOut(dollyScale) {

			scale /= dollyScale;

		}

		function dollyIn(dollyScale) {

			scale *= dollyScale;

		}

		// event handlers - FSM: listen for events and reset state

		function handleMouseDownRotate(event) {

			rotateStart.set(event.clientX, event.clientY);

		}

		function handleMouseDownDolly(event) {

			dollyStart.set(event.clientX, event.clientY);

		}

		function handleMouseDownPan(event) {

			panStart.set(event.clientX, event.clientY);

		}

		function handleMouseMoveRotate(event) {

			rotateEnd.set(event.clientX, event.clientY);

			rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

			const element = scope.domElement;

			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

			rotateStart.copy(rotateEnd);

			scope.update();

		}

		function handleMouseMoveDolly(event) {

			dollyEnd.set(event.clientX, event.clientY);

			dollyDelta.subVectors(dollyEnd, dollyStart);

			if (dollyDelta.y > 0) {

				dollyOut(getZoomScale());

			} else if (dollyDelta.y < 0) {

				dollyIn(getZoomScale());

			}

			dollyStart.copy(dollyEnd);

			scope.update();

		}

		function handleMouseMovePan(event) {

			panEnd.set(event.clientX, event.clientY);

			panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

			pan(panDelta.x, panDelta.y);

			panStart.copy(panEnd);

			scope.update();

		}

		function handleMouseUp() {

			// no-op

		}

		function handleMouseWheel(event) {

			if (event.deltaY < 0) {

				dollyIn(getZoomScale());

			} else if (event.deltaY > 0) {

				dollyOut(getZoomScale());

			}

			scope.update();

		}
		// Touch events

		function handleTouchStartRotate(event) {

			if (event.touches.length == 1) {

				rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

			} else {

				rotateStart.set(
					0.5 * (event.touches[0].pageX + event.touches[1].pageX),
					0.5 * (event.touches[0].pageY + event.touches[1].pageY)
				);

			}

		}

		function handleTouchStartDollyPan(event) {

			if (event.touches.length == 2) {

				const dx = event.touches[0].pageX - event.touches[1].pageX;
				const dy = event.touches[0].pageY - event.touches[1].pageY;

				const distance = Math.sqrt(dx * dx + dy * dy);

				dollyStart.set(0, distance);

				const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
				const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

				panStart.set(x, y);

			}

		}

		function handleTouchMoveRotate(event) {

			if (event.touches.length == 1) {

				rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

			} else {

				rotateEnd.set(
					0.5 * (event.touches[0].pageX + event.touches[1].pageX),
					0.5 * (event.touches[0].pageY + event.touches[1].pageY)
				);

			}

			rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);

			const element = scope.domElement;

			rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
			rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);

			rotateStart.copy(rotateEnd);

			scope.update();

		}

		function handleTouchMoveDollyPan(event) {

			if (event.touches.length == 2) {

				// dolly

				const dx = event.touches[0].pageX - event.touches[1].pageX;
				const dy = event.touches[0].pageY - event.touches[1].pageY;

				const distance = Math.sqrt(dx * dx + dy * dy);

				dollyEnd.set(0, distance);

				dollyDelta.subVectors(dollyEnd, dollyStart);

				if (dollyDelta.y > 0) {

					dollyOut(getZoomScale());

				} else if (dollyDelta.y < 0) {

					dollyIn(getZoomScale());

				}

				dollyStart.copy(dollyEnd);

				// pan

				const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
				const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

				panEnd.set(x, y);

				panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

				pan(panDelta.x, panDelta.y);

				panStart.copy(panEnd);

				scope.update();

			}

		}

		function handleTouchEnd() {

			// no-op

		}

		function handleKeyDown(event) {

			switch (event.code) {

				case scope.keys.UP:
					pan(0, scope.keyPanSpeed);
					scope.update();
					break;

				case scope.keys.BOTTOM:
					pan(0, - scope.keyPanSpeed);
					scope.update();
					break;

				case scope.keys.LEFT:
					pan(scope.keyPanSpeed, 0);
					scope.update();
					break;

				case scope.keys.RIGHT:
					pan(- scope.keyPanSpeed, 0);
					scope.update();
					break;

			}

		}

		// helpers

		function onPointerDown(event) {

			if (scope.enabled === false) return;

			switch (event.pointerType) {
				case 'mouse':
				case 'pen':
					onMouseDown(event);
					break;
				case 'touch':
					onTouchStart(event);
					break;
			}

		}

		function onPointerMove(event) {

			if (scope.enabled === false) return;

			switch (event.pointerType) {
				case 'mouse':
				case 'pen':
					onMouseMove(event);
					break;
				case 'touch':
					onTouchMove(event);
					break;
			}

		}

		function onPointerUp(event) {

			switch (event.pointerType) {
				case 'mouse':
				case 'pen':
					onMouseUp();
					break;
				case 'touch':
					onTouchEnd();
					break;
			}

		}
		function onMouseDown(event) {

			event.preventDefault();

			switch (event.button) {

				case 0:
					if (scope.enableRotate === false) return;

					handleMouseDownRotate(event);

					state = STATE.ROTATE;

					break;

				case 1:
					if (scope.enableZoom === false) return;

					handleMouseDownDolly(event);

					state = STATE.DOLLY;

					break;

				case 2:
					if (scope.enablePan === false) return;

					handleMouseDownPan(event);

					state = STATE.PAN;

					break;

			}

			if (state !== STATE.NONE) {

				scope.domElement.ownerDocument.addEventListener('pointermove', onPointerMove);
				scope.domElement.ownerDocument.addEventListener('pointerup', onPointerUp);

			}

		}

		function onMouseMove(event) {

			event.preventDefault();

			switch (state) {

				case STATE.ROTATE:
					if (scope.enableRotate === false) return;

					handleMouseMoveRotate(event);

					break;

				case STATE.DOLLY:
					if (scope.enableZoom === false) return;

					handleMouseMoveDolly(event);

					break;

				case STATE.PAN:
					if (scope.enablePan === false) return;

					handleMouseMovePan(event);

					break;

			}

		}

		function onMouseUp() {

			scope.domElement.ownerDocument.removeEventListener('pointermove', onPointerMove);
			scope.domElement.ownerDocument.removeEventListener('pointerup', onPointerUp);

			state = STATE.NONE;

		}

		function onMouseWheel(event) {

			if (scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE) return;

			event.preventDefault();

			handleMouseWheel(event);

		}

		// Touch handlers

		function onTouchStart(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			switch (event.touches.length) {

				case 1:
					if (scope.enableRotate === false) return;

					handleTouchStartRotate(event);

					state = STATE.TOUCH_ROTATE;

					break;

				case 2:
					if (scope.enableZoom === false && scope.enablePan === false) return;

					handleTouchStartDollyPan(event);

					state = STATE.TOUCH_DOLLY_PAN;

					break;

				default:

					state = STATE.NONE;

			}

		}

		function onTouchMove(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

			switch (event.touches.length) {

				case 1:
					if (scope.enableRotate === false) return;
					if (state !== STATE.TOUCH_ROTATE) return;

					handleTouchMoveRotate(event);

					break;

				case 2:
					if (scope.enableZoom === false && scope.enablePan === false) return;
					if (state !== STATE.TOUCH_DOLLY_PAN) return;

					handleTouchMoveDollyPan(event);

					break;

				default:

					state = STATE.NONE;

			}

		}

		function onTouchEnd(event) {

			state = STATE.NONE;

		}

		function onContextMenu(event) {

			if (scope.enabled === false) return;

			event.preventDefault();

		}

		function onKeyDown(event) {

			if (scope.enabled === false || scope.enablePan === false) return;

			handleKeyDown(event);

		}

		// public API

		this.getPolarAngle = function () {

			return spherical.phi;

		};

		this.getAzimuthAngle = function () {

			return spherical.theta;

		};

		this.saveState = function () {

			scope.target0.copy(scope.target);
			scope.position0.copy(scope.object.position);
			scope.zoom0 = scope.object.zoom;

		};

		this.reset = function () {

			scope.target.copy(scope.target0);
			scope.object.position.copy(scope.position0);
			scope.object.zoom = scope.zoom0;

			scope.object.updateProjectionMatrix();
			scope.dispatchEvent({ type: 'change' });

			scope.update();

			state = STATE.NONE;

		};
		this.update = function () {

			const offset = new Vector3();

			const quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));
			const quatInverse = quat.clone().invert();

			const lastPosition = new Vector3();
			const lastQuaternion = new Quaternion();

			return function update() {

				const position = scope.object.position;

				offset.copy(position).sub(scope.target);

				offset.applyQuaternion(quat);

				spherical.setFromVector3(offset);

				if (scope.autoRotate && state === STATE.NONE) {

					rotateLeft(getAutoRotationAngle());

				}

				spherical.theta += sphericalDelta.theta;
				spherical.phi += sphericalDelta.phi;

				spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));
				spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

				spherical.makeSafe();

				spherical.radius *= scale;

				spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

				scope.target.add(panOffset);

				offset.setFromSpherical(spherical);

				offset.applyQuaternion(quatInverse);

				position.copy(scope.target).add(offset);

				scope.object.lookAt(scope.target);

				if (scope.enableDamping === true) {

					sphericalDelta.theta *= (1 - scope.dampingFactor);
					sphericalDelta.phi *= (1 - scope.dampingFactor);

					panOffset.multiplyScalar(1 - scope.dampingFactor);

				} else {

					sphericalDelta.set(0, 0, 0);

					panOffset.set(0, 0, 0);

				}

				scale = 1;

				if (
					zoomChanged ||
					lastPosition.distanceToSquared(scope.object.position) > EPS ||
					8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS
				) {

					scope.dispatchEvent({ type: 'change' });

					lastPosition.copy(scope.object.position);
					lastQuaternion.copy(scope.object.quaternion);
					zoomChanged = false;

					return true;

				}

				return false;

			};

		}();

		// listeners

		this.domElement.addEventListener('contextmenu', onContextMenu);
		this.domElement.addEventListener('pointerdown', onPointerDown);
		this.domElement.addEventListener('wheel', onMouseWheel, { passive: false });

		this.domElement.ownerDocument.addEventListener('pointermove', onPointerMove);
		this.domElement.ownerDocument.addEventListener('pointerup', onPointerUp);

		if (scope.domElement.tabIndex === -1) {

			scope.domElement.tabIndex = 0;

		}

		scope.domElement.addEventListener('keydown', onKeyDown);

		// force an update at start

		this.update();

	}

}

export { OrbitControls };
