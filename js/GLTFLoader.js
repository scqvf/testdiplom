import {
	DefaultLoadingManager,
	FileLoader,
	Loader,
	Mesh,
	MeshStandardMaterial,
	MeshBasicMaterial,
	MeshPhysicalMaterial,
	Group,
	Scene,
	TextureLoader,
	Vector2,
	Vector3,
	Matrix4,
	Quaternion,
	BufferGeometry,
	BufferAttribute,
	InterleavedBufferAttribute,
	Skeleton,
	Bone,
	SkinnedMesh,
	AnimationClip,
	AnimationMixer,
	NumberKeyframeTrack,
	QuaternionKeyframeTrack,
	VectorKeyframeTrack,
	Box3,
	SRGBColorSpace
} from './three.module.js';

class GLTFLoader extends Loader {

	constructor(manager) {
		super(manager);
		this.dracoLoader = null;
		this.ktx2Loader = null;
		this.meshoptDecoder = null;
	}

	load(url, onLoad, onProgress, onError) {

		const scope = this;

		const loader = new FileLoader(this.manager);
		loader.setPath(this.path);
		loader.setResponseType('arraybuffer');
		loader.setRequestHeader(this.requestHeader);
		loader.setWithCredentials(this.withCredentials);

		loader.load(url, function (data) {

			try {
				scope.parse(data, onLoad);
			} catch (e) {
				if (onError) onError(e);
				else console.error(e);
				scope.manager.itemError(url);
			}

		}, onProgress, onError);

	}

	parse(data, onLoad) {

		// We'll use the THREE GLTFParser, which is bundled inside
		// the official GLTFLoader build from the examples/jsm folder.
		// Here is the minimal embedded parser:

		const textDecoder = new TextDecoder('utf-8');
		const magic = textDecoder.decode(new Uint8Array(data, 0, 4));

		if (magic !== 'glTF') {
			throw new Error('Not a binary glTF (.glb) file.');
		}

		const view = new DataView(data);

		// Header: magic + version + length
		const version = view.getUint32(4, true);

		if (version < 2.0) {
			throw new Error('Unsupported GLB version. Only GLB v2 is supported.');
		}

		let offset = 12;
		let jsonChunkLength = view.getUint32(offset, true); offset += 4;
		let jsonChunkFormat = view.getUint32(offset, true); offset += 4;

		if (jsonChunkFormat !== 0x4E4F4A53) {
			throw new Error('GLB: First chunk is not JSON.');
		}

		const jsonChunk = new Uint8Array(data, offset, jsonChunkLength);
		const jsonText = textDecoder.decode(jsonChunk);
		const json = JSON.parse(jsonText);

		offset += jsonChunkLength;

		let binChunk = null;

		if (offset < data.byteLength) {
			let binLength = view.getUint32(offset, true); offset += 4;
			let binFormat = view.getUint32(offset, true); offset += 4;

			if (binFormat !== 0x004E4942) {
				throw new Error('GLB: Second chunk is not BIN.');
			}

			binChunk = data.slice(offset, offset + binLength);
		}

		// Build a simple scene with Meshes

		const scene = new Group();

		if (!json.meshes || json.meshes.length === 0) {
			console.warn('GLTFLoader: No meshes in model.');
			onLoad(scene);
			return;
		}

		for (let meshDef of json.meshes) {
			if (!meshDef.primitives || meshDef.primitives.length === 0) continue;

			const prim = meshDef.primitives[0];

			if (!prim.attributes || !prim.attributes.POSITION) continue;

			const positions = new Float32Array(binChunk, 0, prim.attributes.POSITION.count * 3);
			const geom = new BufferGeometry();
			geom.setAttribute('position', new BufferAttribute(positions, 3));

			let material = new MeshStandardMaterial({ color: 0xffffff });

			if (json.materials && json.materials[prim.material]) {
				const matDef = json.materials[prim.material];
				if (matDef.pbrMetallicRoughness && matDef.pbrMetallicRoughness.baseColorFactor) {
					const f = matDef.pbrMetallicRoughness.baseColorFactor;
					material.color.setRGB(f[0], f[1], f[2]);
				}
			}

			const mesh = new Mesh(geom, material);
			scene.add(mesh);
		}

		onLoad({ scene });
	}
}

export { GLTFLoader };
