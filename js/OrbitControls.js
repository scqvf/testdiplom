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

		this.domElement.style.touchAction = 'none';

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

		this.minPolarAngle = 0;
		this.maxPolarAngle = Math.PI;

		this.minAzimuthAngle = - Infinity;
		this.maxAzimuthAngle = Infinity;

		this.enableDamping = false;
		this.dampingFactor = 0.05;

		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true;
		this.keyPanSpeed = 7.0;

		this.autoRotate = false;
		this.autoRotateSpeed = 2.0;

		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		this.target0 = this.target.clone();
		this.position0 = this.object.position.clone();
		this.zoom0 = this.object.zoom;

		this._domElementKeyEvents = null;

		const scope = this;

		const STATE = {
			NONE: - 1,
			ROTATE: 0,
			DOLLY: 1,
			PAN: 2,
			TOUCH_ROTATE: 3,
			TOUCH_DOLLY_PAN: 4
		};

		let state = STATE.NONE;

		const EPS = 0.000001;

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

				v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
				v.multiplyScalar(- distance);

				panOffset.add(v);

			};

		}());

		const panUp = (function () {

			const v = new Vector3();

			return function panUp(distance, objectMatrix) {

				v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
				v.multiplyScalar(distance);

				panOffset.add(v);

			};

		}());

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

					console.warn('WARNING: OrbitControls.js: Unsupported camera type');

				}

			};

		}());

		function dollyOut(dollyScale) {

			scale /= dollyScale;

		}

		function dollyIn(dollyScale) {

			scale *= dollyScale;

		}

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

		function handleMouseUp() {}

		function handleMouseWheel(event) {

			if (event.deltaY < 0) {

				dollyIn(getZoomScale());

			} else if (event.deltaY > 0) {

				dollyOut(getZoomScale());

			}

			scope.update();

		}

		this.handleMouseDownRotate = handleMouseDownRotate;
		this.handleMouseDownDolly = handleMouseDownDolly;
		this.handleMouseDownPan = handleMouseDownPan;
		this.handleMouseMoveRotate = handleMouseMoveRotate;
		this.handleMouseMoveDolly = handleMouseMoveDolly;
		this.handleMouseMovePan = handleMouseMovePan;
		this.handleMouseUp = handleMouseUp;
		this.handleMouseWheel = handleMouseWheel;

		// Touch handlers, keyboard handlers, update(), listeners...
		// (Остальной код стандартный — могу прислать полностью, если хочешь)
	}

}

export { OrbitControls };
