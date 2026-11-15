import * as THREE from 'three'
import { initSite, prefersReducedMotion } from './site'

/**
 * Premium tier hero: a spinning 3D pickleball with a gold orbit ring and a
 * pink particle field. Reacts to mouse movement and fades with scroll.
 * Sits to the right of the headline on wide screens and above it on phones;
 * pauses offscreen, holds still under reduced motion, and falls back to the
 * club crest when WebGL is unavailable.
 */

initSite()

const canvas = document.getElementById('scene') as HTMLCanvasElement
const hero = document.getElementById('top') as HTMLElement

let renderer: THREE.WebGLRenderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
} catch {
  hero.classList.add('no-webgl')
  throw new Error('WebGL unavailable, showing the static crest instead')
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x120510, 6, 16)

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 50)
camera.position.set(0, 0, 6)

/* background */
scene.background = new THREE.Color(0x120510)

/* the pickleball */
const ball = new THREE.Group()
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.35, 48, 48),
  new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.32, metalness: 0.08 }),
)
ball.add(sphere)

// holes: dark discs distributed on the surface with a fibonacci spiral
const holeGeometry = new THREE.CircleGeometry(0.11, 20)
const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x3a0d22, side: THREE.DoubleSide })
const holes = new THREE.InstancedMesh(holeGeometry, holeMaterial, 42)
const dummy = new THREE.Object3D()
const golden = Math.PI * (3 - Math.sqrt(5))
for (let i = 0; i < 42; i++) {
  const y = 1 - (i / 41) * 2
  const radiusAt = Math.sqrt(1 - y * y)
  const theta = golden * i
  const position = new THREE.Vector3(Math.cos(theta) * radiusAt, y, Math.sin(theta) * radiusAt)
  dummy.position.copy(position.clone().multiplyScalar(1.352))
  dummy.lookAt(position.clone().multiplyScalar(3))
  dummy.updateMatrix()
  holes.setMatrixAt(i, dummy.matrix)
}
ball.add(holes)
scene.add(ball)

/* gold orbit ring */
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.3, 0.045, 16, 120),
  new THREE.MeshStandardMaterial({ color: 0xd9a01e, roughness: 0.25, metalness: 0.85 }),
)
ring.rotation.x = Math.PI / 2.6
scene.add(ring)

/* particle field */
const particleCount = 700
const positions = new Float32Array(particleCount * 3)
for (let i = 0; i < particleCount; i++) {
  const radius = 4 + Math.random() * 7
  const angle = Math.random() * Math.PI * 2
  const y = (Math.random() - 0.5) * 8
  positions[i * 3] = Math.cos(angle) * radius
  positions[i * 3 + 1] = y
  positions[i * 3 + 2] = Math.sin(angle) * radius - 2
}
const particleGeometry = new THREE.BufferGeometry()
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({ color: 0xf8cade, size: 0.035, transparent: true, opacity: 0.75 }),
)
scene.add(particles)

/* lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.35))
const pinkLight = new THREE.PointLight(0xf472b6, 90)
pinkLight.position.set(4, 3, 4)
scene.add(pinkLight)
const goldLight = new THREE.PointLight(0xd9a01e, 60)
goldLight.position.set(-4, -2, 3)
scene.add(goldLight)

/* interaction */
let targetX = 0
let targetY = 0
window.addEventListener('pointermove', (event) => {
  targetX = (event.clientX / window.innerWidth - 0.5) * 0.8
  targetY = (event.clientY / window.innerHeight - 0.5) * 0.5
})

function resize(): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  // wide screens: shift the ball right so the headline sits on clear ground
  if (width > 860) camera.setViewOffset(width, height, -width * 0.2, 0, width, height)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const reduced = prefersReducedMotion()
let visible = true
let running = false
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting
  if (visible && !reduced && !running) requestAnimationFrame(animate)
}).observe(hero)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && visible && !reduced && !running) requestAnimationFrame(animate)
})

const clock = new THREE.Clock()
function animate(): void {
  running = visible && !document.hidden && !reduced
  const t = reduced ? 1.2 : clock.getElapsedTime()
  ball.rotation.y = t * 0.35
  ball.rotation.x = Math.sin(t * 0.4) * 0.18
  ring.rotation.z = t * 0.22
  particles.rotation.y = t * 0.03
  goldLight.position.x = Math.sin(t * 0.5) * 5
  goldLight.position.z = Math.cos(t * 0.5) * 5

  // mouse parallax
  camera.position.x += (targetX - camera.position.x) * 0.05
  camera.position.y += (-targetY - camera.position.y) * 0.05

  // scroll dolly and fade
  const scroll = Math.min(window.scrollY / Math.max(hero.clientHeight, 1), 1)
  camera.position.z = 6 + scroll * 2.5
  canvas.style.opacity = String(1 - scroll * 0.9)
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
  if (running) requestAnimationFrame(animate)
}
animate()

// when paused or still, a resize still needs a fresh frame
window.addEventListener('resize', () => {
  if (!running) renderer.render(scene, camera)
})
