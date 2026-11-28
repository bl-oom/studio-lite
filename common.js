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
  // ===== ビート（テンポと拍の位置）を音から読み取る =====
  // mono: Float32Array（モノラル）, sr: サンプリング周波数 → {bpm, period(秒), t0(最初の拍の秒), conf}
  beatTrack(mono,sr){
    const N=1024,hop=256,nF=Math.floor((mono.length-N)/hop);if(nF<64)return null;
    // FFT（実数）
    const re=new Float32Array(N),im=new Float32Array(N),win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
    const rev=new Uint32Array(N);for(let i=0,j=0;i<N;i++){rev[i]=j;let b=N>>1;while(j&b){j^=b;b>>=1}j|=b}
    const fft=()=>{for(let i=0;i<N;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
      for(let s=2;s<=N;s<<=1){const h=s>>1,a=-2*Math.PI/s;for(let k=0;k<h;k++){const wr=Math.cos(a*k),wi=Math.sin(a*k);for(let i=k;i<N;i+=s){const j=i+h,tr=wr*re[j]-wi*im[j],ti=wr*im[j]+wi*re[j];re[j]=re[i]-tr;im[j]=im[i]-ti;re[i]+=tr;im[i]+=ti}}}};
    // スペクトルの立ち上がり（低〜中域を重め）
    const H=N/2,maxBin=Math.min(H,Math.round(8000/sr*N)),lowBin=Math.max(3,Math.round(250/sr*N)),prev=new Float32Array(H),onset=new Float32Array(nF),onLow=new Float32Array(nF);
    for(let f=0;f<nF;f++){const o=f*hop;for(let i=0;i<N;i++){re[i]=mono[o+i]*win[i];im[i]=0}fft();
      let flux=0,fl=0;for(let k=1;k<maxBin;k++){const m=Math.log1p(100*Math.hypot(re[k],im[k]));const d=m-prev[k];if(d>0){flux+=d;if(k<lowBin)fl+=d}prev[k]=m}onset[f]=flux;onLow[f]=fl}
    // ならす（ローカル平均を引く）
    const fr=sr/hop,w=Math.round(fr*0.5);
    const detr=src=>{const o=new Float32Array(nF);let acc=0;const q=[];for(let f=0;f<nF;f++){acc+=src[f];q.push(src[f]);if(q.length>w)acc-=q.shift();o[f]=Math.max(0,src[f]-acc/q.length)}
      const m=o.reduce((a,b)=>a+b,0)/nF||1;for(let f=0;f<nF;f++)o[f]/=m;return o};
    const od=detr(onset),odL=detr(onLow);
    // 拍の位置はキック（低音）を重視して決める
    const ph2=new Float32Array(nF);for(let f=0;f<nF;f++)ph2[f]=odL[f]+0.35*od[f];
    // テンポ：自己相関（60〜200BPM、120BPM付近を少し優先）
    const lmin=Math.ceil(fr*60/185),lmax=Math.ceil(fr*60/60);let best=-1,bl=0;const ac=new Float32Array(lmax+2);
    for(let l=lmin;l<=lmax+1;l++){let s=0;for(let f=l;f<nF;f++)s+=od[f]*od[f-l];ac[l]=s/(nF-l)}
    for(let l=lmin;l<=lmax;l++){const bpm=60*fr/l,wgt=Math.exp(-0.5*Math.pow(Math.log2(bpm/120)/0.9,2));
      // 倍のテンポの山も足して、拍の取り違いを減らす
      const s=(ac[l]+0.5*(ac[2*l]||0))*wgt;if(s>best){best=s;bl=l}}
    let lag=bl;{const a=ac[bl-1]||0,b=ac[bl],c=ac[bl+1]||0,d=a-2*b+c;if(d<0)lag=bl+0.5*(a-c)/d}
    // 細かく合わせる：全体で拍の位置が一番そろう周期と位相
    const score=(L,ph)=>{let s=0,n=0;for(let x=ph;x<nF-1;x+=L){const i=Math.floor(x),r=x-i;s+=ph2[i]*(1-r)+ph2[i+1]*r;n++}return n?s/n:0};
    let bestS=-1,bestL=lag,bestP=0;
    for(let L=lag*0.995;L<=lag*1.005;L+=lag*0.0005){for(let ph=0;ph<L;ph+=0.5){const s=score(L,ph);if(s>bestS){bestS=s;bestL=L;bestP=ph}}}
    const period=bestL/fr;let t0=(bestP*hop+N/2)/sr+0.01;while(t0-period>=0)t0-=period;
    return{bpm:60/period,period,t0,conf:bestS};
  },
  // ファイルから読む（モノラル22.05kHzに変換して解析）
  async beatsFromFile(file){const sr=22050;const oac=new OfflineAudioContext({numberOfChannels:1,length:1,sampleRate:sr});
    const buf=await oac.decodeAudioData(await file.arrayBuffer());const ch=buf.getChannelData(0);let mono=ch;
    if(buf.numberOfChannels>1){const c1=buf.getChannelData(1);mono=new Float32Array(ch.length);for(let i=0;i<ch.length;i++)mono[i]=(ch[i]+c1[i])/2}
    // 長い曲は最初の2分半で十分
    if(mono.length>sr*150)mono=mono.subarray(0,sr*150);
    const r=BL.beatTrack(mono,sr);if(r)r.duration=buf.duration;return r},
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
