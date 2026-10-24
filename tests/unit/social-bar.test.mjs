import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const source = await build({ stdin: { contents: "export * from './game/src/screens/room/social-bar-model';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false });
const { uniqueSocialPlayers, socialDisplayName, socialPageCount, clampSocialPage, socialPageSlots, socialProgressLabel } = await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'));
const players = count => Array.from({ length: count }, (_, index) => ({ playerId: `player-${index}`, displayName: `Player ${index}`, level: index + 1, experience: index * 7 }));

test('real friends retain identity and order; duplicate or empty IDs never become invented cards', () => {
  const real = players(2);
  assert.deepEqual(uniqueSocialPlayers([real[0], { ...real[1], playerId: '' }, real[0], real[1]]), real);
  assert.deepEqual(socialPageSlots(real, 0).slice(1, 3).map(slot => slot.player), real);
  assert.equal(socialPageSlots(real, 0).filter(slot => slot.kind === 'invite').length, 2);
  assert.equal(socialPageSlots(real, 0).filter(slot => slot.kind === 'empty').length, 4);
});

test('no friends leaves six identity-free middle cards and invitations only at the ends', () => {
  const slots = socialPageSlots([], 0);
  assert.equal(slots.length, 8);
  assert.deepEqual(slots.map(slot => slot.kind), ['invite', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'invite']);
  assert.equal(slots.some(slot => 'player' in slot), false);
  assert.equal(socialPageCount(0), 1);
});

test('six players fill one page between permanent invites; seven use two pages', () => {
  const six = players(6);
  assert.equal(socialPageCount(six.length), 1);
  const full = socialPageSlots(six, 0);
  assert.equal(full.length, 8);
  assert.equal(full[0].kind, 'invite');
  assert.equal(full[7].kind, 'invite');
  assert.deepEqual(full.slice(1, 7).map(slot => slot.player), six);
  assert.equal(full.filter(slot => slot.kind === 'invite').length, 2);
  assert.equal(full.some(slot => slot.kind === 'empty'), false);

  const seven = players(7);
  assert.equal(socialPageCount(seven.length), 2);
  assert.deepEqual(socialPageSlots(seven, 0).filter(slot => slot.kind === 'player').map(slot => slot.player), seven.slice(0, 6));
  const last = socialPageSlots(seven, 1);
  assert.equal(last.length, 8);
  assert.equal(last[0].kind, 'invite');
  assert.equal(last[7].kind, 'invite');
  assert.deepEqual(last.filter(slot => slot.kind === 'player').map(slot => slot.player), seven.slice(6));
  assert.equal(last.filter(slot => slot.kind === 'invite').length, 2);
  assert.equal(last.filter(slot => slot.kind === 'empty').length, 5);
  assert.equal(clampSocialPage(20, 7), 1);
  assert.equal(clampSocialPage(1, 6), 0);
  assert.equal(clampSocialPage(-1, 0), 0);
});

test('missing progress is not replaced by fake production values', () => {
  assert.equal(socialProgressLabel(0), '0');
  assert.equal(socialProgressLabel(12345.9), '12345');
  assert.equal(socialProgressLabel(NaN), '—');
  assert.equal(socialProgressLabel(-10), '—');
});

test('unavailable names display Vizinho while known players keep their own names', () => {
  assert.equal(socialDisplayName(''), 'Vizinho');
  assert.equal(socialDisplayName('  \t\n'), 'Vizinho');
  assert.equal(socialDisplayName('Alison'), 'Alison');
  assert.equal(socialDisplayName(' Everton '), 'Everton');
});
