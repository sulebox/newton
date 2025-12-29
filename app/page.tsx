// =========================================================
// 3. Newton (修正版: 正確なフレームレート対応)
// =========================================================
function Newton({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/newton.glb');
  const { actions } = useAnimations(animations, group);
  const { newtonReaction, resetReaction } = useGame(); 
  
  const [showQuestionBubble, setShowQuestionBubble] = useState(false);
  const [showGravityBubble, setShowGravityBubble] = useState(false);
  
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // 正確なアニメーション時間 (49フレーム / 30fps ≒ 1633ms)
  // 少し余裕を持たせず、ピッタリかごくわずかに短いくらいが繋ぎ目が綺麗です
  const TURN_DURATION = 1630; 

  const playAction = (name: string, duration: number = 0.5) => {
    const newAction = actions[name];
    if (!newAction) return;
    
    // 違うアクションならフェードアウト
    if (currentAction.current && currentAction.current !== newAction) {
      currentAction.current.fadeOut(duration);
    }
    
    // 設定をリセットしてから適用
    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);

    // ★修正: rightturn は1回切りで止める設定を徹底する
    if (name === 'rightturn') {
      newAction.setLoop(THREE.LoopOnce, 1); 
      newAction.clampWhenFinished = true;   // 終わったら最後のポーズで固定
    } else {
      newAction.setLoop(THREE.LoopRepeat, Infinity);
      newAction.clampWhenFinished = false;
    }

    newAction.fadeIn(duration).play();
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
      playAction('hatena');
      setShowQuestionBubble(true);
      
      timeout1 = setTimeout(() => {
        playAction('idle');
        setShowQuestionBubble(false);
        resetReaction();
      }, 4000);

    } else if (newtonReaction === 'turnAndInspiration') {
      // --- パターンB: ターン -> ひらめき -> 戻りターン ---
      
      // 1. 最初のターン開始
      playAction('rightturn', 0.2); // フェードインも少し早めに
      
      // ★修正: 待ち時間を1.7秒(1700ms)から1.63秒(1630ms)に変更
      timeout1 = setTimeout(() => {
        
        // アニメーション停止
        if (actions['rightturn']) actions['rightturn'].stop();
        if (currentAction.current === actions['rightturn']) currentAction.current = null;

        // 2. 物理的に後ろを向く
        if (group.current) group.current.rotation.y += Math.PI; 
        
        // ひらめき再生
        playAction('inspiration', 0.2);
        setShowGravityBubble(true);
        
        timeout2 = setTimeout(() => {
          // 3. ひらめき完了: 戻りターン開始
          setShowGravityBubble(false);
          playAction('rightturn', 0.2);

          // ★修正: ここも戻り時間に合わせて 1630ms に変更
          timeout3 = setTimeout(() => {
            
            // アニメーション停止
            if (actions['rightturn']) actions['rightturn'].stop();
            if (currentAction.current === actions['rightturn']) currentAction.current = null;

            // 4. 物理的に前を向く
            if (group.current) group.current.rotation.y -= Math.PI; 
            
            // アイドルへ戻る
            playAction('idle', 0.5);
            resetReaction();
          }, TURN_DURATION);

        }, 6000);
      }, TURN_DURATION);
      
    } else {
      // idle状態
      playAction('idle');
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
