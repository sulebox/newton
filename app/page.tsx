'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// =========================================================
// 1. 背景と木 (残す)
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
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* 木 */}
      <primitive object={treeScene} position={[0, 0, 0]} scale={2.0} />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// =========================================================
// 2. Neco (残す)
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

    // 8〜15秒のランダム間隔で「にゃあ」
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
// 3. Newton (新規追加)
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

    // アニメーションがあれば最初のものを再生
    if (animations.length > 0) {
      const actionName = animations[0].name;
      const action = actions[actionName];
      if (action) action.reset().fadeIn(0.5).play();
      return () => {
        if (action) action.fadeOut(0.5);
      };
    }
  }, [actions, animations, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
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
      {/* タイトルテキスト変更 */}
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

          {/* Neco (既存: 位置そのまま) */}
          <Neco position={[0, 0, -2.5]} />

          {/* Newton (新規: 指定位置) */}
          <Newton position={[1.5, 0, 2.5]} />
        </Suspense>
      </Canvas>
    </div>
  );
}