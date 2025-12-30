'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, createContext, useContext } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// モデルをプリロード
useGLTF.preload('/models/tree.glb');
useGLTF.preload('/models/neco.glb');
useGLTF.preload('/models/newton.glb');
useGLTF.preload('/models/apple.glb');

// =========================================================
// 定数・型定義
// =========================================================
const GRAVITY = 0.005;
const GROUND_Y = 0.1;
const APPLE_SPAWN_CENTER = new THREE.Vector3(0.5, 3.6, -0.5);

type NewtonReaction = 'idle' | 'hatena' | 'turnAndInspiration';

// ゲームの状態管理用コンテキスト
interface GameContextType {
  newtonReaction: NewtonReaction;
  triggerReaction: () => void;
  resetReaction: () => void;
  isPlaying: boolean;
}
const GameContext = createContext<GameContextType>({} as GameContextType);

// =========================================================
// Context Provider
// =========================================================
function GameProvider({ children }: { children: React.ReactNode }) {
  const [newtonReaction, setNewtonReaction] = useState<NewtonReaction>('idle');
  const [isPlaying, setIsPlaying] = useState(false);

  const triggerReaction = () => {
    if (isPlaying) return;

    setIsPlaying(true);

    // 7割 hatena, 3割 turnAndInspiration
    const rand = Math.random();
    if (rand < 0.7) {
      setNewtonReaction('hatena');
    } else {
      setNewtonReaction('turnAndInspiration');
    }
  };

  const resetReaction = () => {
    setNewtonReaction('idle');
    setIsPlaying(false);
  };

  return (
    <GameContext.Provider value={{ newtonReaction, triggerReaction, resetReaction, isPlaying }}>
      {children}
    </GameContext.Provider>
  );
}
const useGame = () => useContext(GameContext);

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
          <div style={bubbleStyle}>
            にゃあ
            <div style={bubbleArrowStyle} />
          </div>
        </Html>
      )}
    </group>
  );
}

// =========================================================
// 3. Newton (修正版: stopを使わず、即時100%ウェイトで上書きする)
// =========================================================
function Newton({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/newton.glb');
  const { actions } = useAnimations(animations, group);
  const { newtonReaction, resetReaction } = useGame(); 
  
  const [showQuestionBubble, setShowQuestionBubble] = useState(false);
  const [showGravityBubble, setShowGravityBubble] = useState(false);
  
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  const TURN_DURATION = 1580; 

  // アニメーション再生関数
  const playAction = (name: string, duration: number = 0.2) => {
    const newAction = actions[name];
    if (!newAction) return;
    
    // すでに別のアクションが動いていたら処理
    if (currentAction.current && currentAction.current !== newAction) {
      if (duration > 0) {
        currentAction.current.fadeOut(duration);
      } else {
        // ★ご提案の実装: stop()は使わず、単にウェイトを0にするか、
        // 次のアクションが即座に上書きするので、ここは「何もしない」か「stop」でも良いのですが、
        // 念の為 stop() してリソースを解放します。
        // ただし、重要なのは「この直後に newAction が即座に適用されること」です。
        currentAction.current.stop();
      }
    }
    
    // 設定リセット
    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1); // ★確実にウェイト100%にする

    // ループ設定
    if (name === 'rightturn') {
      newAction.setLoop(THREE.LoopOnce, 1); 
      newAction.clampWhenFinished = true;
    } else {
      newAction.setLoop(THREE.LoopRepeat, Infinity);
      newAction.clampWhenFinished = false;
    }

    // 再生
    if (duration > 0) {
      newAction.fadeIn(duration).play();
    } else {
      // ★duration:0 の時はフェードなしで「即」再生
      newAction.play();
    }
    
    currentAction.current = newAction;
  };

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }, [scene]);

  useEffect(() => {
    let timeout1: NodeJS.Timeout;
    let timeout2: NodeJS.Timeout;
    let timeout3: NodeJS.Timeout;

    if (newtonReaction === 'hatena') {
      // --- パターンA: hatena ---
      playAction('hatena', 0.2);
      setShowQuestionBubble(true);
      
      timeout1 = setTimeout(() => {
        playAction('idle', 0.2);
        setShowQuestionBubble(false);
        resetReaction();
      }, 4000);

    } else if (newtonReaction === 'turnAndInspiration') {
      // --- パターンB: ターン -> ひらめき -> 戻りターン ---
      
      // 1. ターン開始
      playAction('rightturn', 0.2); 
      
      timeout1 = setTimeout(() => {
        // 2. 物理的に後ろを向く
        if (group.current) group.current.rotation.y += Math.PI; 
        
        // ★修正: 手動stopは削除。playAction(..., 0) に任せる
        // これで「後ろ向きの余韻」を「ひらめき(正面)」が即座に上書きする
        playAction('inspiration', 0); 
        
        setShowGravityBubble(true);
        
        timeout2 = setTimeout(() => {
          // 3. 戻りターン開始
          setShowGravityBubble(false);
          // ここも即時切り替え
          playAction('rightturn', 0); 

          timeout3 = setTimeout(() => {
            // 4. 物理的に前を向く
            if (group.current) group.current.rotation.y -= Math.PI; 
            
            // ★修正: ここも手動stop削除。playAction(..., 0) に任せる
            // rightturn(アニメ上の後ろ向き) を idle(アニメ上の正面) が即座に上書きする
            playAction('idle', 0);
            
            resetReaction();
          }, TURN_DURATION);

        }, 6000);
      }, TURN_DURATION);
      
    } else {
      // idle状態
      playAction('idle', 0.2);
      setShowQuestionBubble(false);
      setShowGravityBubble(false);
    }

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newtonReaction]); 

  return (
    <group ref={group} position={position}>
      <primitive object={scene} scale={1.8} />
      {showQuestionBubble && (
        <Html position={[0, 2.6, 0]} center>
          <div style={{...bubbleStyle, fontSize: '24px', padding: '8px 16px'}}>
            ？
            <div style={bubbleArrowStyle} />
          </div>
        </Html>
      )}
      {showGravityBubble && (
        <Html position={[0, 2.7, 0]} center>
          <div style={{...bubbleStyle, fontSize: '14px', padding: '10px 14px', backgroundColor: '#fffacd'}}>
            引っ張られてたのかー！
            <div style={{...bubbleArrowStyle, borderTopColor: '#fffacd'}} />
          </div>
        </Html>
      )}
    </group>
  );
}

// =========================================================
// 4. Apple
// =========================================================
function Apple({ startPos, endZOffset }: { startPos: THREE.Vector3, endZOffset: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/apple.glb');
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  
  const position = useRef(startPos.clone());
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isLanded = useRef(false);
  
  const targetEndY = GROUND_Y + Math.random() * 0.1;
  const targetEndX = startPos.x + (Math.random() - 0.5) * 0.5;
  const targetEndZ = startPos.z + endZOffset;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
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
      group.current.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    }
    group.current.position.copy(position.current);
  });

  useEffect(() => { if(group.current) group.current.position.copy(startPos); }, [startPos]);
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
      timeoutId = setTimeout(spawnApple, Math.random() * (10000 - 3000) + 3000);
    };
    spawnApple();
    return () => clearTimeout(timeoutId);
  }, []);
  return <>{apples.map(apple => <Apple key={apple.id} startPos={apple.start} endZOffset={apple.offset} />)}</>;
}

// =========================================================
// UIコンポーネント
// =========================================================
function UIOverlay() {
  const { triggerReaction, isPlaying } = useGame();
  
  const showBubble = isPlaying;

  return (
    <>
      <button
        onClick={triggerReaction}
        disabled={isPlaying} 
        style={{
          position: 'absolute', bottom: '20px', right: '20px', zIndex: 20,
          padding: '12px 24px', 
          backgroundColor: isPlaying ? '#ccc' : '#ff6e6e', 
          color: 'white', border: 'none',
          borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', 
          cursor: isPlaying ? 'default' : 'pointer',
          boxShadow: isPlaying ? 'none' : '0 4px 6px rgba(0,0,0,0.2)',
          transform: isPlaying ? 'scale(0.95)' : 'scale(1)',
          transition: 'all 0.2s ease'
        }}
      >
        ニュートンに知らせる
      </button>
      
      <div style={{
        position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 15, pointerEvents: 'none',
        opacity: showBubble ? 1 : 0, transition: 'opacity 0.3s ease-in-out'
      }}>
        <div style={{...bubbleStyle, fontSize: '18px', padding: '10px 20px', backgroundColor: '#fff0f0'}}>
          ニュートンうしろー！
          <div style={{...bubbleArrowStyle, borderTopColor: '#fff0f0'}} />
        </div>
      </div>
    </>
  );
}

// =========================================================
// スタイル定数
// =========================================================
const bubbleStyle: React.CSSProperties = {
  background: 'white', padding: '6px 10px', borderRadius: '12px', color: '#333',
  whiteSpace: 'nowrap', fontSize: '12px', fontFamily: 'sans-serif', fontWeight: 'bold',
  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', position: 'relative', border: '1px solid #ddd'
};
const bubbleArrowStyle: React.CSSProperties = {
  position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
  width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
  borderTop: '5px solid white'
};

// =========================================================
// メインページ
// =========================================================
function AppContent() {
  const [zoom, setZoom] = useState(80);
  useEffect(() => {
    const handleResize = () => setZoom(window.innerWidth < 768 ? 55 : 80);
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
      
      <UIOverlay />
    </div>
  );
}

// =========================================================
// export default
// =========================================================
export default function Home() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
