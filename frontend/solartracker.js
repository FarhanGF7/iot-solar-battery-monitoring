// ======================
// === solartracker.js ===
// ======================

//  Inisialisasi Scene, Camera, Renderer 
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("visualisasi").appendChild(renderer.domElement);

//  Pencahayaan 
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffee88, 1.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// Objek Matahari 
const sunGeometry = new THREE.SphereGeometry(0.35, 24, 24);
const sunMaterial = new THREE.MeshStandardMaterial({
  color: 0xffdd33,
  emissive: 0xffaa00,
  emissiveIntensity: 1
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.castShadow = false;
scene.add(sun);

// Tanah 
const groundGeometry = new THREE.PlaneGeometry(40, 40);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Material dasar 
const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 });

// Dudukan dasar 
const baseFrame = new THREE.Mesh(
  new THREE.BoxGeometry(3, 0.1, 3),
  baseMaterial
);
baseFrame.position.y = 0.05;
baseFrame.castShadow = true;
baseFrame.receiveShadow = true;
scene.add(baseFrame);

//  Panel Surya
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 512;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#001a33';
ctx.fillRect(0, 0, 512, 512);
ctx.strokeStyle = '#66ccff';
ctx.lineWidth = 2;
for (let i = 0; i <= 512; i += 64) {
  ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
}
const gridTexture = new THREE.CanvasTexture(canvas);

const panelMaterial = new THREE.MeshPhysicalMaterial({
  map: gridTexture,
  metalness: 0.9,
  roughness: 0.18,
  clearcoat: 0.85,
  clearcoatRoughness: 0.05
});

const panelFrame = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.08, 2.2),
  new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 })
);
panelFrame.castShadow = true;

const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 2), panelMaterial);
solarPanel.position.y = 0.05;
solarPanel.castShadow = true;
solarPanel.receiveShadow = true;

// group panel
const panelGroup = new THREE.Group();
panelGroup.add(panelFrame);
panelGroup.add(solarPanel);
scene.add(panelGroup);

// holder (rotasi horizontal)
const holder = new THREE.Group();
holder.position.y = 0;
holder.add(panelGroup);
scene.add(holder);

// tggi panel dan tiang disesuaikan
panelGroup.position.y = 3.0;
const poleHeight = panelGroup.position.y - 0.05;
const pole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 16),
  baseMaterial
);
pole.position.set(0, poleHeight / 2, 0);
pole.castShadow = true;
holder.add(pole);

// ompas teks
function buatKompas() {
  const group = new THREE.Group();
  const loader = new THREE.FontLoader();

  loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', font => {
    const arah = [
      { t: 'N',  x: 0,   z: -4 },
      { t: 'S',  x: 0,   z: 4 },
      { t: 'E',  x: 4,   z: 0 },
      { t: 'W',  x: -4,  z: 0 },
      { t: 'NE', x: 2.8, z: -2.8 },
      { t: 'SE', x: 2.8, z: 2.8 },
      { t: 'SW', x: -2.8,z: 2.8 },
      { t: 'NW', x: -2.8,z: -2.8 }
    ];

    arah.forEach(a => {
      const geo = new THREE.TextGeometry(a.t, {
        font,
        size: 0.35,
        height: 0.02
      });
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      mesh.position.set(a.x - 0.2, 0.02, a.z);
      group.add(mesh);
    });
  });
  return group;
}

const kompas = buatKompas();
scene.add(kompas);

//  Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);
controls.update();

// Beam kuning
const beamMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
const beamGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 0)
]);
const sunBeam = new THREE.Line(beamGeometry, beamMaterial);
scene.add(sunBeam);

// variabel Servo & LDR 
let servoX = 90, servoY = 90;
let ldr1 = 0, ldr2 = 0, ldr3 = 0, ldr4 = 0;

let lastServoX = null;
let lastServoY = null;

// Panel Update 
function updatePanel() {
  const rotY = THREE.MathUtils.degToRad(servoX);
  const rotX = THREE.MathUtils.degToRad(90 - servoY);
  holder.rotation.y = rotY;
  panelGroup.rotation.x = rotX;
}

// Update Posisi Matahari 
function updateSunPosition() {
  const radius = 10;
  const panelCenterWorld = new THREE.Vector3();
  panelGroup.getWorldPosition(panelCenterWorld);
  const panelUpLocal = new THREE.Vector3(0, 1, 0);
  const panelQuaternion = new THREE.Quaternion();
  panelGroup.getWorldQuaternion(panelQuaternion);
  const panelNormalWorld = panelUpLocal.clone().applyQuaternion(panelQuaternion).normalize();
  const sunPos = panelCenterWorld.clone().add(panelNormalWorld.clone().multiplyScalar(radius));
  sun.position.copy(sunPos);
  sunLight.position.copy(sun.position);
  const pts = [sun.position.clone(), panelCenterWorld.clone()];
  sunBeam.geometry.setFromPoints(pts);
}

//  Kompas + Elevasi 
function updateSunInfo() {
  let arah = "";
 
  // Tentukan zona berdasarkan kombinasi servoX (horizontal) dan servoY (vertikal) 
  const keUtara = servoY >= 90;

  if (servoX >= 0 && servoX < 22.5) {
    arah = keUtara ? "Utara" : "Selatan";
  } else if (servoX >= 22.5 && servoX < 67.5) {
    arah = keUtara ? "Barat Laut" : "Tenggara";
  } else if (servoX >= 67.5 && servoX < 112.5) {
    arah = keUtara ? "Barat" : "Timur";
  } else if (servoX >= 112.5 && servoX < 157.5) {
    arah = keUtara ? "Barat Daya" : "Timur Laut";
  } else if (servoX >= 157.5 && servoX <= 180) {
    arah = keUtara ? "Selatan" : "Utara";
  }

  // Hitung elevasi 
  const elevasi = 90 - servoY;

  // Update UI 
  const arahEl = document.getElementById("arahMatahari");
  const elevEl = document.getElementById("elevasiMatahari");
  const kompasEl = document.getElementById("kompasDerajat");

  if (arahEl) arahEl.innerText = arah;
  if (elevEl) elevEl.innerText = `${elevasi.toFixed(1)}°`;
  if (kompasEl) kompasEl.innerText = `${servoX.toFixed(1)}°`;
}


// Update Info Panel UI 
function updateInfoPanel() {
  const elX = document.getElementById("servoX");
  const elY = document.getElementById("servoY");
  if (elX) elX.innerText = `${servoX.toFixed(1)}°`;
  if (elY) elY.innerText = `${servoY.toFixed(1)}°`;
  const ids = ['ldr1', 'ldr2', 'ldr3', 'ldr4'];
  [ldr1, ldr2, ldr3, ldr4].forEach((v, i) => {
    const el = document.getElementById(ids[i]);
    if (el) el.innerText = v;
  });
}

//  Socket.IO 
const socket = io();
socket.on('connect', () => console.log('✅ Terkoneksi ke server realtime'));
socket.on('servoData', data => {
  if (!data) return;
  servoX = Number(data.servoX) || servoX;
  servoY = Number(data.servoY) || servoY;
  ldr1 = Number(data.ldr1) || ldr1;
  ldr2 = Number(data.ldr2) || ldr2;
  ldr3 = Number(data.ldr3) || ldr3;
  ldr4 = Number(data.ldr4) || ldr4;
});

// der Loop 
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // hanya update kalau ada data servo baru dari ESP
  if (servoX !== lastServoX || servoY !== lastServoY) {
    updatePanel();
    updateSunPosition();
    updateSunInfo();
    lastServoX = servoX;
    lastServoY = servoY;
  }

  updateInfoPanel(); // tetap update data di UI
  renderer.render(scene, camera);
}
animate();

//  Resize 
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

