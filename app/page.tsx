'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// モデルをプリロード
useGLTF.preload('/models/tree.glb');
useGLTF.preload('/models/neco.glb');
useGLTF.preload('/models/newton.glb');
useGLTF.preload('/models/apple.glb');

// =========================================================
// 定数
// =========================================================
const GRAVITY = 0.005; 
const GROUND_Y = 0.1; 
const APPLE_SPAWN_CENTER = new THREE.Vector3(0.5, 3.6, -0.5); 

// =========================================================
// 1. 背景と木
// =========================================================
function SceneEnvironment() {
  const { scene: treeScene } = useGLTF('/models/tree.glb');
  
  useEffect(() => {
    treeScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [treeScene]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      <primitive object={treeScene} position={[0, 0, 0]} scale={2.0} />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// =========================================================
// 2. Neco
// =========================================================
function Neco({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/neco.glb');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { actions } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    let timeoutId: NodeJS.Timeout;
    const scheduleMeow = () => {
      const randomInterval = Math.random() * 7000 + 8000;
      timeoutId = setTimeout(() => {
        setShowBubble(true);
        setTimeout(() => setShowBubble(false), 3000);
        scheduleMeow();
      }, randomInterval);
    };
    scheduleMeow();
    return () => clearTimeout(timeoutId);
  }, [scene]);

  return (
    <group ref={group} position={position}>
      <primitive object={scene} scale={1.8} />
      {showBubble && (
        <Html position={[0, 1.0, 0]} center>
          <div style={{
            background: 'white', padding: '6px 10px', borderRadius: '12px', color: '#333',
            whiteSpace: 'nowrap', fontSize: '12px', fontFamily: 'sans-serif', fontWeight: 'bold',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', position: 'relative', border: '1px solid #ddd'
          }}>
            にゃあ
            <div style={{
              position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderTop: '5px solid white'
            }} />
          </div>
        </Html>
      )}
    </group>
  );
}

// =========================================================
// 3. Newton
// =========================================================
function Newton({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/newton.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    const idleAction = actions['idle'];
    if (idleAction) {
      idleAction.reset().fadeIn(0.5).play();
    }
  }, [actions, animations, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// =========================================================
// 4. Apple (修正版: クローン対応 & 影設定)
// =========================================================
function Apple({ startPos, endZOffset }: { startPos: THREE.Vector3, endZOffset: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/apple.glb');

  // ★重要: シーンをクローンして、個別のリンゴとして扱えるようにする
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  
  const position = useRef(startPos.clone());
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isLanded = useRef(false);
  
  const targetEndY = GROUND_Y + Math.random() * 0.1;
  const targetEndX = startPos.x + (Math.random() - 0.5) * 0.5;
  const targetEndZ = startPos.z + endZOffset;

  // ★重要: 影の設定（receiveShadow = false にして影がかからないようにする）
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;    // 地面に影は落とす
        child.receiveShadow = false; // 木などの影は受けない（明るいまま）
      }
    });
  }, [clonedScene]);

  useFrame((state, delta) => {
    if (isLanded.current || !group.current) return;

    const timeScale = delta * 60;
    velocity.current.y -= GRAVITY * timeScale;
    position.current.add(velocity.current.clone().multiplyScalar(timeScale));
    position.current.x += (targetEndX - position.current.x) * 0.02 * timeScale;
    position.current.z += (targetEndZ - position.current.z) * 0.02 * timeScale;

    if (position.current.y <= targetEndY) {
      position.current.y = targetEndY;
      isLanded.current = true;
      group.current.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
    }
    group.current.position.copy(position.current);
  });

  // 初期位置
  useEffect(() => {
    if(group.current) group.current.position.copy(startPos);
  }, [startPos]);

  return <primitive ref={group} object={clonedScene} scale={1.2} />;
}

// =========================================================
// 5. ApplesController
// =========================================================
function ApplesController() {
  const [apples, setApples] = useState<{ id: number, start: THREE.Vector3, offset: number }[]>([]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const spawnApple = () => {
      const start = new THREE.Vector3(
        APPLE_SPAWN_CENTER.x + (Math.random() - 0.5) * 0.8,
        APPLE_SPAWN_CENTER.y + (Math.random() - 0.5) * 0.2,
        APPLE_SPAWN_CENTER.z + (Math.random() - 0.5) * 0.8
      );
      const offset = (Math.random() - 0.5) * 1.5;

      setApples(prev => [...prev, { id: Date.now(), start, offset }]);

      const nextInterval = Math.random() * (10000 - 3000) + 3000;
      timeoutId = setTimeout(spawnApple, nextInterval);
    };

    spawnApple();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      {apples.map(apple => (
        <Apple key={apple.id} startPos={apple.start} endZOffset={apple.offset} />
      ))}
    </>
  );
}

// =========================================================
// メインページ
// =========================================================
export default function Home() {
  const [zoom, setZoom] = useState(80);
  
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setZoom(isMobile ? 55 : 80);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 10, pointerEvents: 'none', textAlign: 'center', width: '100%',
      }}>
        <h1 style={{
          color: '#ff6e6e', fontSize: 'clamp(24px, 5vw, 42px)', fontFamily: '"Times New Roman", Times, serif',
          fontWeight: 'normal', letterSpacing: '0.05em', textShadow: '0px 1px 2px rgba(0,0,0,0.1)'
        }}>Newton, watch out behind you!</h1>
      </div>

      <Canvas shadows>
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={zoom} near={0.1} far={200} onUpdate={c => c.lookAt(0, 2.5, 0)} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-top={25} shadow-camera-right={25} shadow-camera-bottom={-25} shadow-camera-left={-25} shadow-camera-far={50} shadow-bias={-0.0001} />

        <Suspense fallback={null}>
          <SceneEnvironment />
          <Neco position={[0, 0, -2.5]} />
          <Newton position={[1.5, 0, 2.5]} />
          <ApplesController />
        </Suspense>
      </Canvas>
    </div>
  );
}
