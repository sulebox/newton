// =========================================================
// 3. Newton (修正版: チラつき完全防止 & セリフ変更)
// =========================================================
function Newton({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/newton.glb');
  const { actions } = useAnimations(animations, group);
  const { newtonReaction, resetReaction } = useGame(); 
  
  const [showQuestionBubble, setShowQuestionBubble] = useState(false);
  const [showGravityBubble, setShowGravityBubble] = useState(false);
  
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // 通常のアニメーション再生用
  const playAction = (name: string, duration: number = 0.5) => {
    const newAction = actions[name];
    if (!newAction) return;
    
    // 違うアクションならフェードアウト
    if (currentAction.current && currentAction.current !== newAction) {
      currentAction.current.fadeOut(duration);
    }
    
    newAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
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
      playAction('rightturn');
      
      timeout1 = setTimeout(() => {
        // ★修正: アニメーションをフェードアウトさせずに「即死」させる
        // これで「アニメの180度」がなくなり、同時に「本体の180度」が入るので、見た目は動かない
        if (actions['rightturn']) actions['rightturn'].stop();
        if (currentAction.current === actions['rightturn']) currentAction.current = null;

        // 2. 物理的に後ろを向く
        if (group.current) group.current.rotation.y += Math.PI; 
        
        // ひらめき再生
        playAction('inspiration', 0.2);
        setShowGravityBubble(true);
        
        timeout2 = setTimeout(() => {
          // 3. ひらめき完了: 吹き出し消して戻りターン開始
          setShowGravityBubble(false);
          playAction('rightturn');

          timeout3 = setTimeout(() => {
            // ★修正: 戻る時も即停止
            if (actions['rightturn']) actions['rightturn'].stop();
            if (currentAction.current === actions['rightturn']) currentAction.current = null;

            // 4. 物理的に前を向く
            if (group.current) group.current.rotation.y -= Math.PI; 
            
            // アイドルへ戻る
            playAction('idle', 0.2);
            resetReaction();
          }, 1700);

        }, 6000);
      }, 1700);
      
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

      {/* セリフ変更: 「引っ張られてたのかー！」 */}
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
