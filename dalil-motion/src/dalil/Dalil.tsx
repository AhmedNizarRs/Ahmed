// DALIL — 32 s product reel, 9:16 @ 60 fps, Arabic on-screen text, no voiceover.
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Caption, Sfx, World, makeCamera} from '../kit/kit';
import {EXPO, IN_OUT, arabic, pop, tween} from '../kit/theme';
import {Bg, Clip, D, Halo, NoIcon, Person, Tube, geist, mix, mono} from './parts';

export const DALIL_TOTAL = 1920;

const EXPO_IN = Easing.bezier(0.7, 0, 0.84, 0);
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const CAP_Y = 1440;

const Full: React.FC<{children: React.ReactNode}> = ({children}) => (
	<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
		{children}
	</svg>
);

// ---------- 1. The signs are on the wall, out of reach ----------
const S1: React.FC = () => {
	const f = useCurrentFrame();
	const cam = makeCamera([
		{f: 0, x: 540, y: 1150, z: 1.45},
		{f: 85, x: 540, y: 960, z: 1},
		{f: 196, x: 540, y: 960, z: 1},
		{f: 240, x: 540, y: 1130, z: 4, ease: EXPO_IN},
	]);
	const railP = tween(f, 0, 60, 0, 1, IN_OUT);
	const fade = 1 - tween(f, 214, 24, 0, 1, IN_OUT);
	const signs = [
		{x: 230, g: '2', at: 45},
		{x: 540, g: 'exit', at: 85},
		{x: 850, g: '201', at: 125},
	] as const;
	const dimP = tween(f, 162, 34, 0, 1, IN_OUT);
	const dot = pop(f, 176);
	return (
		<AbsoluteFill>
			<Bg />
			<World cam={cam}>
				<Full>
					<g opacity={fade}>
						<Tube x1={-80} y1={1300} x2={1160} y2={860} p={railP} />
						{signs.map((s) => {
							const p = pop(f, s.at);
							return (
								<g key={s.x} transform={`translate(${s.x} 300) scale(${0.7 + 0.3 * p})`} opacity={Math.min(1, p)}>
									<rect x={-100} y={-80} width={200} height={160} rx={16} fill={D.bg2} stroke={D.line} strokeWidth={3} />
									{s.g === 'exit' ? (
										<path d="M-46 0 H30 M8 -26 L36 0 L8 26" fill="none" stroke={D.fg} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
									) : (
										<text x={0} y={s.g === '2' ? 32 : 22} textAnchor="middle" fontFamily={geist} fontWeight={600} fontSize={s.g === '2' ? 96 : 64} fill={D.fg}>
											{s.g}
										</text>
									)}
								</g>
							);
						})}
						{/* how far the sign is from the hand */}
						<g stroke={D.y} strokeWidth={4} strokeLinecap="round" fill="none">
							<line x1={540} y1={1046} x2={540} y2={1046 - 640 * dimP} />
							<path d="M522 1028 L540 1046 L558 1028" opacity={dimP > 0 ? 1 : 0} />
							<path d="M522 424 L540 406 L558 424" opacity={dimP > 0.98 ? 1 : 0} />
						</g>
					</g>
					<circle cx={540} cy={1080} r={14 * dot} fill={D.y} />
				</Full>
			</World>
			<Caption text="الطابق؟" from={45} to={85} y={CAP_Y} size={84} weight={600} />
			<Caption text="المخرج؟" from={85} to={125} y={CAP_Y} size={84} weight={600} />
			<Caption text="الغرفة؟" from={125} to={160} y={CAP_Y} size={84} weight={600} />
			<Caption text="كلها على الجدار… بعيدة عن اليد." from={160} to={226} y={CAP_Y - 40} size={70} weight={600} accent={['اليد.']} />
		</AbsoluteFill>
	);
};

// ---------- 2. 21.8 million people ----------
const S2: React.FC = () => {
	const f = useCurrentFrame();
	const z = interpolate(f, [0, 26, 110], [4, 4, 1], {...CLAMP, easing: IN_OUT});
	const people: React.ReactNode[] = [];
	for (let r = -2; r <= 5; r++) {
		for (let c = 0; c < 15; c++) {
			if (r === 0 && c === 7) continue;
			const d = Math.hypot(c - 7, r);
			const p = pop(f, 30 + d * 5);
			people.push(<Person key={`${r}-${c}`} x={540 + (c - 7) * 64} y={760 + r * 100} color={D.fg3} s={Math.max(0, p)} op={0.5 * Math.min(1, p)} />);
		}
	}
	const v = 21.8 * tween(f, 56, 96, 0, 1, Easing.bezier(0.22, 1, 0.36, 1));
	const numIn = tween(f, 50, 30);
	return (
		<AbsoluteFill>
			<Bg />
			<Full>
				<g transform={`translate(540 760) scale(${z}) translate(-540 -760)`}>
					{people}
					<Person x={540} y={760} color={D.y} body={tween(f, 2, 26)} />
				</g>
			</Full>
			<div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', opacity: numIn, transform: `translateY(${(1 - numIn) * 40}px)`}}>
				<div style={{fontFamily: geist, fontWeight: 300, fontSize: 250, letterSpacing: -10, color: D.y, fontVariantNumeric: 'tabular-nums', lineHeight: 1}}>{v.toFixed(1)}</div>
			</div>
			<Caption text="مليون" from={70} to={260} y={400} size={72} weight={500} />
			<Caption text="شخص في منطقتنا يعيشون مع ضعف البصر" from={110} to={204} y={CAP_Y - 40} size={68} weight={600} accent={['البصر']} />
		</AbsoluteFill>
	);
};

// ---------- 3. The handrail is already in their hand. It's blank. ----------
const S3: React.FC = () => {
	const f = useCurrentFrame();
	// blinds: six strips open from their centre lines
	const strips = [0, 1, 2, 3, 4, 5]
		.map((i) => {
			const h = 160 * tween(f, i * 3, 30, 0, 1, IN_OUT) + 0.5;
			const c = i * 320 + 160;
			return `M0 ${c - h} H1080 V${c + h} H0 Z`;
		})
		.join(' ');
	const scale = interpolate(f, [0, 246], [1.1, 1], CLAMP);
	const slot = tween(f, 160, 40, 0, 1, IN_OUT);
	return (
		<AbsoluteFill style={{clipPath: f < 50 ? `path('${strips}')` : undefined}}>
			<Bg />
			<div style={{position: 'absolute', left: 60, top: 240, width: 960, height: 1000, borderRadius: 28, overflow: 'hidden'}}>
				<div style={{position: 'absolute', inset: 0, transform: `scale(${scale})`}}>
					<Img src={staticFile('dalil/hand-blank.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
					<svg width={960} height={1000} style={{position: 'absolute', inset: 0}}>
						<g transform="translate(300 790) rotate(-36)">
							<rect x={-120} y={-80} width={240} height={160} rx={18} fill="none" stroke={D.y} strokeWidth={6} strokeDasharray="18 14" pathLength={800} strokeDashoffset={0} opacity={slot} />
						</g>
					</svg>
				</div>
				<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(11,12,14,0) 60%, rgba(11,12,14,0.55) 100%)'}} />
			</div>
			<Caption text="الدرابزين أصلاً في يدهم…" from={50} to={146} y={CAP_Y - 20} size={72} weight={600} />
			<Caption text="لكنه فاضي." from={150} to={300} y={CAP_Y - 20} size={92} weight={600} accent={['فاضي.']} />
		</AbsoluteFill>
	);
};

// ---------- 4. DALIL snaps onto the rail ----------
const RAIL4 = {x1: -80, y1: 990, x2: 1160, y2: 900};
const ANG4 = (Math.atan2(RAIL4.y2 - RAIL4.y1, RAIL4.x2 - RAIL4.x1) * 180) / Math.PI;

const S4: React.FC = () => {
	const f = useCurrentFrame();
	// colour-block wipe: a slanted yellow band sweeps up and leaves the scene behind it
	const e = interpolate(f, [0, 40], [2200, -420], {...CLAMP, easing: IN_OUT});
	const wiping = f < 42;
	const land = 80;
	const drop = interpolate(f, [56, land], [-320, 945], {...CLAMP, easing: Easing.in(Easing.quad)});
	const shake = f > land ? 7 * Math.exp(-(f - land) / 6) * Math.sin((f - land) * 1.3) : 0;
	const ring = (d: number) => tween(f, land + d, 50, 0, 1, Easing.out(Easing.cubic));
	// camera: slow push, then zoom-through into the clip's plate
	const push = interpolate(f, [40, 186], [1, 1.06], CLAMP);
	const z = f < 186 ? push : interpolate(f, [186, 226], [1.06, 16], {...CLAMP, easing: EXPO_IN});
	const fx = interpolate(f, [186, 226], [540, 535.6], CLAMP);
	const fy = interpolate(f, [186, 226], [960, 884.4], CLAMP);
	const txt = 1 - tween(f, 178, 16, 0, 1, IN_OUT);
	const letters = 'DALIL'.split('');
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{clipPath: wiping ? `polygon(0 ${e + 120}px, 1080px ${e - 120}px, 1080px 1920px, 0 1920px)` : undefined}}>
				<Bg />
				<AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(540px, 960px) scale(${z}) translate(${-fx}px, ${-fy}px)`}}>
					<Full>
						<g transform={`translate(0 ${shake})`}>
							<Tube {...RAIL4} />
						</g>
						{[0, 14].map((d) => (
							<ellipse
								key={d}
								cx={540}
								cy={945}
								rx={340 + 260 * ring(d)}
								ry={200 + 160 * ring(d)}
								fill="none"
								stroke={D.y}
								strokeWidth={3}
								opacity={f > land + d ? 0.6 * (1 - ring(d)) : 0}
							/>
						))}
						{f >= 56 ? <Clip x={540} y={drop + shake} s={1.6} rot={ANG4} /> : null}
					</Full>
					<div style={{position: 'absolute', top: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: txt}}>
						{letters.map((l, i) => {
							const p = tween(f, 96 + i * 5, 34);
							return (
								<span key={i} style={{fontFamily: geist, fontWeight: 500, fontSize: 150, color: D.fg, margin: '0 22px', opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: 'inline-block'}}>
									{l}
								</span>
							);
						})}
					</div>
					<div style={{opacity: txt}}>
						<Caption text="دليل" from={120} to={400} y={500} size={84} weight={500} color={D.fg2} />
					</div>
				</AbsoluteFill>
				<div style={{opacity: txt}}>
					<Caption text="مشبك صغير… يخلّي الدرابزين يتكلّم." from={126} to={400} y={CAP_Y - 20} size={70} weight={600} accent={['يتكلّم.']} />
				</div>
			</AbsoluteFill>
			{wiping ? (
				<AbsoluteFill
					style={{
						backgroundColor: D.y,
						clipPath: `polygon(0 ${e + 120 - 300}px, 1080px ${e - 120 - 300}px, 1080px ${e - 120}px, 0 ${e + 120}px)`,
					}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

// ---------- 5. Clip · Touch · Read ----------
const BIG = {x: 540, y: 800, s: 2.1};

const S5: React.FC = () => {
	const f = useCurrentFrame();
	const open = interpolate(f, [24, 40, 66], [170, 170, 0], {...CLAMP, easing: Easing.in(Easing.cubic)});
	const R = f < 150 ? 620 * tween(f, 104, 32) : 620 * (1 - tween(f, 158, 24, 0, 1, IN_OUT));
	const ribs = tween(f, 180, 18, 0, 1, IN_OUT);
	const dots = tween(f, 186, 34, 0, 1, Easing.linear);
	const glyphP = tween(f, 198, 26);
	const flash = 1 - tween(f, 0, 24, 0, 1, IN_OUT);
	const step = f < 100 ? '01' : f < 176 ? '02' : '03';
	return (
		<AbsoluteFill>
			<Bg />
			<Full>
				<Tube x1={-80} y1={BIG.y} x2={1160} y2={BIG.y} w={40 * BIG.s} />
				<Clip x={BIG.x} y={BIG.y} s={BIG.s} open={open} ribs={ribs} dots={dots} glyph="2" glyphP={glyphP} />
			</Full>
			{R > 1 ? (
				<div style={{position: 'absolute', left: 99, top: 560, width: 882, height: 480, borderRadius: 34, overflow: 'hidden', clipPath: `circle(${R}px at 50% 50%)`}}>
					<Img src={staticFile('dalil/hand-clip.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 45%'}} />
				</div>
			) : null}
			<div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 40, letterSpacing: 6, color: D.y, opacity: tween(f, 24, 20) * (1 - tween(f, 250, 14))}}>
				{step} / 03
			</div>
			<Caption text="ركّبه" from={26} to={100} y={210} size={130} weight={600} />
			<Caption text="المسه" from={102} to={176} y={210} size={130} weight={600} />
			<Caption text="اقرأه" from={178} to={400} y={210} size={130} weight={600} accent={['اقرأه']} />
			<Caption text="بثواني… وبدون أدوات" from={50} to={100} y={1130} size={60} weight={500} color={D.fg2} />
			<Caption text="اليد تلقاه وهي ماشية" from={118} to={176} y={1130} size={60} weight={500} color={D.fg2} />
			<Caption text="الطابق 2 · المخرج يسار" from={222} to={400} y={1130} size={60} weight={500} color={D.fg2} />
			<AbsoluteFill style={{backgroundColor: D.plate, opacity: flash}} />
		</AbsoluteFill>
	);
};

// ---------- 6. Ribs tell the hand first ----------
const ITEMS = [
	{label: 'معلومة', n: 1, a: 50, b: 100, px: 820},
	{label: 'سلامة', n: 3, a: 112, b: 158, px: 540},
	{label: 'نهاية الدرج', n: 4, a: 170, b: 200, px: 250},
];

const Item: React.FC<{f: number; it: (typeof ITEMS)[number]}> = ({f, it}) => {
	if (f < it.a) return null;
	const enter = tween(f, it.a, 26);
	const go = tween(f, it.b, 14, 0, 1, IN_OUT);
	const x = 540 + (it.px - 540) * go;
	const y = 1080 + (1330 - 1080) * go;
	const k = (0.9 + 0.1 * enter) * (1 - 0.6 * go);
	const col = mix(D.fg, D.fg2, go);
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${k})`, opacity: enter, display: 'flex', direction: 'rtl', alignItems: 'center', gap: 44, whiteSpace: 'nowrap'}}>
			<div style={{display: 'flex', gap: 16}}>
				{Array.from({length: it.n}).map((_, i) => (
					<div key={i} style={{width: 18, height: 120, borderRadius: 4, background: col, transform: `scaleY(${tween(f, it.a + 4 + i * 4, 20)})`, transformOrigin: '50% 100%'}} />
				))}
			</div>
			<div style={{fontFamily: arabic, fontWeight: 600, fontSize: 110, color: col, direction: 'rtl'}}>{it.label}</div>
		</div>
	);
};

const S6: React.FC = () => {
	const f = useCurrentFrame();
	const m = tween(f, 6, 40, 0, 1, IN_OUT);
	const cy = BIG.y + (600 - BIG.y) * m;
	const s = BIG.s + (1.55 - BIG.s) * m;
	const ribs = f < 112 ? 1 : f < 170 ? 1 + 2 * tween(f, 112, 20, 0, 1, IN_OUT) : 3 + tween(f, 170, 18, 0, 1, IN_OUT);
	const glyph = f < 114 ? '2' : 'up';
	const glyphP = f < 114 ? 1 - tween(f, 106, 8, 0, 1, Easing.linear) : tween(f, 114, 14) * (1 - tween(f, 168, 12, 0, 1, Easing.linear));
	return (
		<AbsoluteFill>
			<Bg />
			<Full>
				<Tube x1={-80} y1={cy} x2={1160} y2={cy} w={40 * s} />
				<Clip x={BIG.x} y={cy} s={s} ribs={ribs} dots={1} glyph={glyph} glyphP={glyphP} />
			</Full>
			<Caption text="اقرأه" from={-60} to={22} y={210} size={130} weight={600} accent={['اقرأه']} />
			<Caption text="الطابق 2 · المخرج يسار" from={-60} to={22} y={1130} size={60} weight={500} color={D.fg2} />
			<Caption text="الخطوط تكلّم اليد أول" from={24} to={230} y={150} size={74} weight={600} accent={['اليد']} />
			{ITEMS.map((it) => (
				<Item key={it.label} f={f} it={it} />
			))}
		</AbsoluteFill>
	);
};

// ---------- 7. Lights off: it glows ----------
const R7 = {x1: -80, y1: 1520, x2: 1160, y2: 700};
const ANG7 = (Math.atan2(R7.y2 - R7.y1, R7.x2 - R7.x1) * 180) / Math.PI;

const S7: React.FC = () => {
	const f = useCurrentFrame();
	const lit = (i: number) => tween(f, 12 + i * 14, 30, 0, 1, IN_OUT);
	const pts = [0.16, 0.39, 0.62, 0.85].map((t) => ({x: R7.x1 + (R7.x2 - R7.x1) * t, y: R7.y1 + (R7.y2 - R7.y1) * t}));
	const ph = tween(f, 100, 36, 0, 1, IN_OUT);
	const phScale = interpolate(f, [100, 210], [1.18, 1.04], CLAMP);
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<AbsoluteFill style={{opacity: tween(f, 6, 20)}}>
				{pts.map((p, i) => (
					<Halo key={i} x={p.x} y={p.y} r={300} o={0.9 * lit(i)} />
				))}
				<Full>
					<Tube {...R7} dim={0.3} />
					{pts.map((p, i) => (
						<g key={i} opacity={0.12 + 0.88 * lit(i)}>
							<Clip x={p.x} y={p.y} s={0.5} rot={ANG7} glow={1} glyph="up" dots={1} ribs={3} />
						</g>
					))}
				</Full>
			</AbsoluteFill>
			{ph > 0 ? (
				<AbsoluteFill style={{opacity: ph}}>
					<Img src={staticFile('dalil/dark-stairs.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 50%', transform: `scale(${phScale})`}} />
					<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 82%)'}} />
				</AbsoluteFill>
			) : null}
			<Caption text="ولمّا تنطفي الأنوار…" from={14} to={112} y={CAP_Y - 20} size={74} weight={600} />
			<Caption text="يضيء." from={118} to={400} y={CAP_Y - 50} size={130} weight={600} accent={['يضيء.']} accentColor={D.glow} />
		</AbsoluteFill>
	);
};

// ---------- 8. No app. No battery. No renovation. ----------
const ROWS = [
	{t: 'بدون تطبيق.', icon: 'phone', y: 700},
	{t: 'بدون بطارية.', icon: 'battery', y: 900},
	{t: 'بدون ترميم.', icon: 'hammer', y: 1100},
] as const;

const S8: React.FC = () => {
	const f = useCurrentFrame();
	const t = tween(f, 0, 36, 0, 1, IN_OUT);
	const w = 300 + (1180 - 300) * t;
	const h = 172 + (2040 - 172) * t;
	const r = 26 * (1 - t);
	const inset = `inset(${(1920 - h) / 2}px ${(1080 - w) / 2}px ${(1920 - h) / 2}px ${(1080 - w) / 2}px round ${r}px)`;
	const out = tween(f, 186, 30, 0, 1, IN_OUT);
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{clipPath: f < 38 ? inset : undefined}}>
				<Bg />
				<AbsoluteFill style={{opacity: 1 - out, transform: `translateY(${-70 * out}px)`}}>
					{ROWS.map((row, i) => {
						const a = 46 + i * 50;
						if (f < a) return null;
						const last = i === ROWS.length - 1;
						const dim = last ? 0 : tween(f, a + 50, 14, 0, 1, IN_OUT);
						const col = last ? D.y : mix(D.fg, D.fg3, dim);
						return (
							<div
								key={row.t}
								style={{
									position: 'absolute',
									top: row.y,
									left: 0,
									right: 0,
									display: 'flex',
									direction: 'rtl',
									justifyContent: 'center',
									alignItems: 'center',
									gap: 40,
									transform: `translateY(-50%) scale(${tween(f, a, 22, 1.5, 1)})`,
									opacity: tween(f, a, 10, 0, 1, Easing.linear),
								}}
							>
								<NoIcon kind={row.icon} p={1} slash={tween(f, a + 14, 16)} color={col} />
								<div style={{fontFamily: arabic, fontWeight: 600, fontSize: last ? 112 : 96, color: col, direction: 'rtl'}}>{row.t}</div>
							</div>
						);
					})}
				</AbsoluteFill>
			</AbsoluteFill>
			{f < 38 ? (
				<div
					style={{
						position: 'absolute',
						left: (1080 - w) / 2 - 10,
						top: (1920 - h) / 2 - 10,
						width: w + 20,
						height: h + 20,
						borderRadius: r + 10,
						border: `6px solid ${D.y}`,
						opacity: 1 - t,
					}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

// ---------- 9. The clip turns into the logo ----------
const K = 2.2;
const LX = 540 - 172 * K; // logo units -> screen
const LY = 620 - 150 * K;
const CX = LX + 150 * K; // centre of the logo's dot on screen
const CY = 620;

const S9: React.FC = () => {
	const f = useCurrentFrame();
	const bg = tween(f, 0, 30, 0, 1, IN_OUT);
	const tubeP = tween(f, 4, 32, 0, 1, IN_OUT);
	const tubeO = 1 - tween(f, 46, 18, 0, 1, IN_OUT);
	const clipY = interpolate(f, [16, 46], [1300, CY], {...CLAMP, easing: EXPO});
	const sx = 1 - tween(f, 40, 12, 0, 1, Easing.in(Easing.cubic));
	const arc = tween(f, 52, 16);
	const bar = tween(f, 50, 22);
	const dot = pop(f, 56);
	const letters = 'DALIL'.split('');
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{opacity: bg}}>
				<Bg />
			</AbsoluteFill>
			<Full>
				<g opacity={tubeO}>
					<Tube x1={-80} y1={CY} x2={1160} y2={CY} p={tubeP} />
				</g>
				{f >= 16 && sx > 0.01 ? <Clip x={CX} y={clipY} s={0.75} sx={sx} /> : null}
				<g transform={`translate(${LX} ${LY}) scale(${K})`}>
					<rect x={150} y={142} width={150 * bar} height={16} fill={D.bone} />
					<g transform={`translate(150 150) scale(${arc} 1) translate(-150 -150)`} opacity={arc > 0.01 ? 1 : 0}>
						<path d="M216.19,201.72 A84,84 0 1 1 216.19,98.28" fill="none" stroke={D.y} strokeWidth={44} strokeLinecap="butt" />
					</g>
					<circle cx={150} cy={150} r={34 * Math.max(0, dot)} fill={D.bone} />
				</g>
			</Full>
			<div style={{position: 'absolute', top: 920, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
				{letters.map((l, i) => {
					const p = tween(f, 74 + i * 5, 34);
					return (
						<span key={i} style={{fontFamily: geist, fontWeight: 500, fontSize: 150, color: D.bone, margin: '0 22px', opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: 'inline-block'}}>
							{l}
						</span>
					);
				})}
			</div>
			<Caption text="دليل" from={98} to={600} y={1105} size={84} weight={500} color={D.fg2} />
			<Caption text="خلّ الطريق يتكلّم." from={118} to={600} y={1290} size={70} weight={600} accent={['يتكلّم.']} />
			<div style={{position: 'absolute', top: 1500, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 40, letterSpacing: 3, color: D.fg3, opacity: tween(f, 146, 30)}}>dalil-team.com</div>
		</AbsoluteFill>
	);
};

// ---------- timeline ----------
// [component, nominal start, frames of transition before that start]
const SCENES: [React.FC, number, number][] = [
	[S1, 0, 0],
	[S2, 240, 0],
	[S3, 450, 36],
	[S4, 660, 40],
	[S5, 870, 24],
	[S6, 1110, 0],
	[S7, 1320, 0],
	[S8, 1530, 36],
	[S9, 1710, 30],
];

export const Dalil: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{backgroundColor: D.bg}}>
			{SCENES.map(([Scene, start, ti], i) => {
				const from = start - ti;
				const end = i + 1 < SCENES.length ? SCENES[i + 1][1] : DALIL_TOTAL;
				return (
					<Sequence key={i} from={from} durationInFrames={end - from}>
						<Scene />
					</Sequence>
				);
			})}
			<Audio src={staticFile('dalil/music.wav')} volume={interpolate(f, [0, 24, DALIL_TOTAL - 40, DALIL_TOTAL], [0, 0.75, 0.75, 0], CLAMP)} />
			<Sfx at={150} src="dalil/riser.wav" volume={0.25} />
			<Sfx at={418} src="dalil/swipe.wav" volume={0.3} />
			<Sfx at={700} src="dalil/thud.wav" volume={0.35} />
			<Sfx at={912} src="dalil/click.wav" volume={0.3} />
			<Sfx at={1070} src="dalil/check.wav" volume={0.28} />
			<Sfx at={1164} src="dalil/tick.wav" volume={0.22} />
			<Sfx at={1226} src="dalil/tick.wav" volume={0.2} />
			<Sfx at={1284} src="dalil/tick.wav" volume={0.22} />
			<Sfx at={1320} src="dalil/click.wav" volume={0.35} />
			<Sfx at={1344} src="dalil/shimmer.wav" volume={0.3} />
			<Sfx at={1494} src="dalil/swipe.wav" volume={0.28} />
			<Sfx at={1640} src="dalil/thud.wav" volume={0.3} />
		</AbsoluteFill>
	);
};
