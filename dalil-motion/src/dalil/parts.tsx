// DALIL building blocks: steel rail, the clip (front view), pictogram person, small line icons.
import {loadFont} from '@remotion/fonts';
import React, {useId} from 'react';
import {AbsoluteFill, staticFile} from 'remotion';

loadFont({family: 'Geist', url: staticFile('dalil/geist-latin.woff2'), weight: '100 900'});
loadFont({family: 'Geist Mono', url: staticFile('dalil/geist-mono-latin.woff2'), weight: '100 900'});

export const geist = 'Geist, sans-serif';
export const mono = '"Geist Mono", monospace';

// Palette from dalil/DESIGN.md
export const D = {
	bg: '#0B0C0E',
	bg2: '#121418',
	bg3: '#1A1D22',
	fg: '#F2F1EC',
	fg2: '#A9B0BA',
	fg3: '#8A929D',
	y: '#FFC700',
	plate: '#FFCF26',
	glow: '#8BF5B0',
	bone: '#F7F5F0',
	line: 'rgba(242,241,236,0.16)',
};

const sid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, t: number) => {
	const A = hex(a);
	const B = hex(b);
	return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

// Stairwell background: near-black with a soft lift in the middle
export const Bg: React.FC<{lift?: number}> = ({lift = 1}) => (
	<AbsoluteFill style={{backgroundColor: D.bg}}>
		<AbsoluteFill style={{background: `radial-gradient(ellipse 80% 55% at 50% 45%, rgba(40,44,52,${0.55 * lift}) 0%, rgba(11,12,14,0) 70%)`}} />
	</AbsoluteFill>
);

// Brushed-steel tube from (x1,y1) to (x2,y2); p = how much of it is drawn
export const Tube: React.FC<{x1: number; y1: number; x2: number; y2: number; w?: number; p?: number; dim?: number}> = ({x1, y1, x2, y2, w = 40, p = 1, dim = 1}) => {
	const id = sid(useId());
	const L = Math.hypot(x2 - x1, y2 - y1);
	const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
	return (
		<g transform={`translate(${x1} ${y1}) rotate(${a})`} opacity={dim}>
			<defs>
				<linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#2B2F35" />
					<stop offset="0.22" stopColor="#D5DAE0" />
					<stop offset="0.42" stopColor="#8E959E" />
					<stop offset="0.8" stopColor="#3A3F46" />
					<stop offset="1" stopColor="#1C1F23" />
				</linearGradient>
			</defs>
			<rect x={0} y={-w / 2} width={Math.max(0, L * p)} height={w} rx={w / 2} fill={`url(#t${id})`} />
		</g>
	);
};

// Braille-style dot pattern on the plate: [cell, column, row]
const DOTS: [number, number, number][] = [
	[0, 0, 0],
	[0, 0, 1],
	[0, 1, 0],
	[0, 1, 2],
	[1, 0, 0],
	[1, 1, 1],
];

// The DALIL clip, front view, centred on (x, y). Local size 420 x 240 before scale `s`.
export const Clip: React.FC<{
	x: number;
	y: number;
	s?: number;
	rot?: number;
	open?: number; // px the two halves are apart
	ribs?: number; // 0..4, fractional = growing
	glyph?: '2' | 'up' | 'none';
	glyphP?: number;
	dots?: number; // 0..1
	glow?: number; // 0 yellow .. 1 glowing green
	sx?: number; // horizontal squash, for the flip into the logo
}> = ({x, y, s = 1, rot = 0, open = 0, ribs = 0, glyph = 'none', glyphP = 1, dots = 0, glow = 0, sx = 1}) => {
	const id = sid(useId());
	const top = mix('#FFD84D', '#C8FFD9', glow);
	const mid = mix(D.y, D.glow, glow);
	const low = mix('#C99600', '#4FC27E', glow);
	const dark = mix('#D9A400', '#5ED38E', glow);
	const plate = mix(D.plate, '#A6FFC4', glow);
	const raised = mix('#E8B200', '#6FDC9C', glow);
	const raisedHi = mix('#FFE27A', '#D6FFE4', glow);

	const body = (
		<g>
			<rect x={-210} y={-112} width={18} height={224} rx={5} fill={dark} />
			<rect x={192} y={-112} width={18} height={224} rx={5} fill={dark} />
			<rect x={-200} y={-102} width={400} height={204} rx={16} fill={`url(#b${id})`} />
			<rect x={-142} y={-79} width={284} height={92} rx={10} fill="rgba(0,0,0,0.16)" />
			<rect x={-142} y={-84} width={284} height={92} rx={10} fill={plate} stroke="rgba(0,0,0,0.10)" strokeWidth={2} />
			{[0, 1, 2, 3].map((i) => {
				const h = 60 * clamp01(ribs - i);
				return h > 0.5 ? (
					<g key={i}>
						<rect x={-124 + i * 18} y={-68 + (60 - h) + 2} width={10} height={h} rx={3} fill="rgba(0,0,0,0.18)" />
						<rect x={-124 + i * 18} y={-68 + (60 - h)} width={10} height={h} rx={3} fill={raised} />
					</g>
				) : null;
			})}
			{glyph !== 'none' ? (
				<g opacity={glyphP} transform={`translate(-14 -38) scale(${0.85 + 0.15 * glyphP}) translate(14 38)`}>
					{glyph === '2' ? (
						<>
							<text x={-12} y={-6} textAnchor="middle" fontFamily={geist} fontWeight={700} fontSize={72} fill="rgba(0,0,0,0.2)">
								2
							</text>
							<text x={-14} y={-9} textAnchor="middle" fontFamily={geist} fontWeight={700} fontSize={72} fill={raised} stroke={raisedHi} strokeWidth={1.5}>
								2
							</text>
						</>
					) : (
						<>
							<path d="M-12 -70 L10 -44 H-3 V-12 H-21 V-44 H-34 Z" fill="rgba(0,0,0,0.2)" transform="translate(2 3)" />
							<path d="M-12 -70 L10 -44 H-3 V-12 H-21 V-44 H-34 Z" fill={raised} stroke={raisedHi} strokeWidth={1.5} />
						</>
					)}
				</g>
			) : null}
			{DOTS.map(([c, col, row], i) => {
				const p = clamp01(dots * DOTS.length - i);
				return p > 0 ? (
					<g key={i} transform={`translate(${44 + c * 46 + col * 18} ${-62 + row * 18}) scale(${p})`}>
						<circle r={6} cy={1.5} fill="rgba(0,0,0,0.22)" />
						<circle r={6} fill={raised} stroke={raisedHi} strokeWidth={1.2} />
					</g>
				) : null;
			})}
		</g>
	);

	return (
		<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s * sx} ${s})`}>
			<defs>
				<linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={top} />
					<stop offset="0.35" stopColor={mid} />
					<stop offset="1" stopColor={low} />
				</linearGradient>
				<clipPath id={`u${id}`}>
					<rect x={-260} y={-200} width={520} height={200} />
				</clipPath>
				<clipPath id={`d${id}`}>
					<rect x={-260} y={0} width={520} height={200} />
				</clipPath>
			</defs>
			{open > 0.01 ? (
				<>
					<g transform={`translate(0 ${-open / s})`} clipPath={`url(#u${id})`}>
						{body}
					</g>
					<g transform={`translate(0 ${open / s})`} clipPath={`url(#d${id})`}>
						{body}
					</g>
				</>
			) : (
				body
			)}
		</g>
	);
};

// Soft green halo behind a glowing clip (screen-space div)
export const Halo: React.FC<{x: number; y: number; r: number; o: number}> = ({x, y, r, o}) => (
	<div
		style={{
			position: 'absolute',
			left: x - r,
			top: y - r,
			width: r * 2,
			height: r * 2,
			borderRadius: '50%',
			opacity: o,
			background: 'radial-gradient(circle, rgba(139,245,176,0.55) 0%, rgba(139,245,176,0.18) 40%, rgba(139,245,176,0) 70%)',
		}}
	/>
);

// Pictogram person; the body grows down out of the head
export const Person: React.FC<{x: number; y: number; color: string; body?: number; s?: number; op?: number}> = ({x, y, color, body = 1, s = 1, op = 1}) => (
	<g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
		<circle r={14} fill={color} />
		<g transform={`translate(0 22) scale(${body}) translate(0 -22)`}>
			<path d="M-20 64 V42 Q-20 23 0 23 Q20 23 20 42 V64 Z" fill={color} />
		</g>
	</g>
);

// Line icons for "No app / No battery / No renovation", with a slash that draws across
export const NoIcon: React.FC<{kind: 'phone' | 'battery' | 'hammer'; p: number; slash: number; color: string}> = ({kind, p, slash, color}) => (
	<svg width={130} height={130} viewBox="-65 -65 130 130" style={{overflow: 'visible', opacity: p}}>
		<g fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
			{kind === 'phone' ? (
				<>
					<rect x={-24} y={-40} width={48} height={80} rx={9} />
					<line x1={-8} y1={28} x2={8} y2={28} />
				</>
			) : kind === 'battery' ? (
				<>
					<rect x={-38} y={-20} width={70} height={40} rx={7} />
					<line x1={40} y1={-7} x2={40} y2={7} strokeWidth={8} />
					<rect x={-29} y={-11} width={18} height={22} rx={2} fill={color} stroke="none" />
				</>
			) : (
				<>
					<line x1={-30} y1={36} x2={10} y2={-4} />
					<path d="M0 -36 L32 -4 L20 8 L-12 -24 Z" />
				</>
			)}
			<line x1={-48} y1={-48} x2={48} y2={48} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - slash} strokeWidth={7} />
		</g>
	</svg>
);
