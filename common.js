// bl-oom Studio Lite 共通部分：道具の一覧と切り替え、前回の道具を覚える、レンダリング、全画面、画面サイズ
(function(){
const TOOLS=[
  {id:'ab-loop',name:'AB Loop',desc:'動画のA〜Bを往復ループして、回数を決めてレンダリング'},
  {id:'slideshow',name:'Slideshow Lite',desc:'写真をつないでスライドショー（ズーム・回転・音楽付き）'},
];
const KEY='bl_studio_last';
const BL={
  TOOLS,
  // Fold7の画面（縦に持った時の 幅×高さ）
  FOLD:{inner:[1968,2184],cover:[1080,2520]},
  // 時間の表示とレンダリングは30pでそろえる
  FPS:30,
  tc(s){if(s==null||!isFinite(s))return'--';let n=Math.round(s*30);const fr=n%30;n=(n-fr)/30;const m=Math.floor(n/60),sec=n%60;return m+':'+String(sec).padStart(2,'0')+':'+String(fr).padStart(2,'0')},
  // くり返しボタン：記号＋文字（ループ＝A→Bまで行ったらAに戻る／バウンド＝A→B→Aと往復）
  modeHTML(bounce){return bounce?'<span class="mi">⇄</span><span class="mt">バウンド</span>':'<span class="mi">↻</span><span class="mt">ループ</span>'},
  fmt(s){if(s==null||!isFinite(s))return'--';const m=Math.floor(s/60),r=s-m*60;return m+':'+(r<10?'0':'')+r.toFixed(1)},
  remember(id){try{localStorage.setItem(KEY,id)}catch(e){}},
  last(){try{const id=localStorage.getItem(KEY);return TOOLS.some(t=>t.id===id)?id:null}catch(e){return null}},
  // レンダリング：H.264の設定を端末が対応するものから選ぶ（大きいサイズは対応レベルの高いものから）
  async pickVideoCfg(W,H,F){const br=Math.max(6e6,Math.round(W*H*F*0.16)),big=W*H>2097152||F>30;
    const list=big?['avc1.640033','avc1.640034','avc1.4d0033','avc1.42e033']:['avc1.640028','avc1.4d0028','avc1.42e028','avc1.640033','avc1.42e01f'];
    for(const codec of list){const c={codec,width:W,height:H,bitrate:br,framerate:F,avc:{format:'avc'}};try{const r=await VideoEncoder.isConfigSupported(c);if(r.supported)return c}catch(e){}}return null},
  async pickAudioCfg(){for(const codec of ['mp4a.40.2','opus']){const c={codec,sampleRate:48000,numberOfChannels:2,bitrate:192000};
    try{const r=await AudioEncoder.isConfigSupported(c);if(r.supported)return c}catch(e){}}return null},
  // 保存するファイル名（日本時間）
  fileName(prefix,ext){return prefix+'_'+new Date(Date.now()+9*3600e3).toISOString().slice(0,19).replace(/[-:T]/g,'')+'.'+ext},
  // プレビューの全画面（もう一度で戻る）
  async toggleFS(el){try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen({navigationUI:'hide'})}catch(e){el.classList.toggle('fs')}},
  // 道具の切り替えボタン（プレビュー左上）と一覧
  switcher(cur,stage){BL.remember(cur);const t=TOOLS.find(x=>x.id===cur);
    const b=document.createElement('button');b.type='button';b.className='bl-sw';b.innerHTML='<i>bl-oom</i> '+t.name+' ▾';
    b.addEventListener('click',e=>{e.stopPropagation();BL.menu(cur)});stage.appendChild(b)},
  menu(cur){if(document.querySelector('.bl-menu'))return;const m=document.createElement('div');m.className='bl-menu';
    m.innerHTML='<h2>bl-oom Studio Lite</h2>'+TOOLS.map(x=>'<button type="button" class="tool'+(x.id===cur?' cur':'')+'" data-id="'+x.id+'"><b>'+x.name+(x.id===cur?'（使用中）':'')+'</b><small>'+x.desc+'</small></button>').join('')+(cur?'<button type="button" class="close okb">閉じる</button>':'');
    m.addEventListener('click',e=>{const x=e.target.closest('[data-id]');if(x){if(x.dataset.id===cur){m.remove();return}BL.remember(x.dataset.id);location.href=(cur?'../':'./')+x.dataset.id+'/';return}
      if(e.target.closest('.close'))m.remove()});document.body.appendChild(m)},
  closeMenu(){const m=document.querySelector('.bl-menu');if(m){m.remove();return true}return false},
};
window.BL=BL;
})();
