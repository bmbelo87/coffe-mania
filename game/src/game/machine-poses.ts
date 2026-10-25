import { Assets, type Texture } from 'pixi.js';
import type { IndoorArtFrame } from './indoor-art';

export interface MachinePose { rotation: number; frame: IndoorArtFrame; texture: Texture }
export interface MachinePoseSpec { rotation: number; frame: IndoorArtFrame }

export async function loadMachinePoses(base: string | URL, frame: IndoorArtFrame, specs?: MachinePoseSpec[]): Promise<MachinePose[]> {
  const definitions = specs ?? [{ rotation: 0, frame }];
  if (!definitions.length || new Set(definitions.map(pose => pose.rotation)).size !== definitions.length ||
      definitions.some(pose => ![0, 1, 2, 3].includes(pose.rotation))) throw new Error('Rotações da máquina inválidas.');
  return Promise.all(definitions.map(async pose => ({ ...pose, texture: await Assets.load<Texture>(new URL(pose.frame.file, base).href) })));
}

/** Facing is independent of evolution; a stage change must never reset a placed machine's rotation. */
export function machinePoseFor(stage: { poses: readonly MachinePose[] }, rotation: number): MachinePose {
  const direction = ((Math.floor(rotation) % 4) + 4) % 4;
  return stage.poses.find(pose => pose.rotation === direction) ?? stage.poses[0];
}
