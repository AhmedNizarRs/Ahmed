import {Composition} from 'remotion';
import {Demo, DEMO_TOTAL} from './Demo';
import {Dalil, DALIL_TOTAL} from './dalil/Dalil';
import {FPS} from './kit/theme';

// Add one <Composition> per video (or per soundtrack variant).
export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Dalil" component={Dalil} durationInFrames={DALIL_TOTAL} fps={FPS} width={1080} height={1920} />
		<Composition id="Demo" component={Demo} durationInFrames={DEMO_TOTAL} fps={FPS} width={1080} height={1920} />
	</>
);
