// Monster image mapping based on monster_id
import monster1 from '@/assets/monsters/monster-1.png';
import monster2 from '@/assets/monsters/monster-2.png';
import monster3 from '@/assets/monsters/monster-3.png';
import monster4 from '@/assets/monsters/monster-4.png';
import monster5 from '@/assets/monsters/monster-5.png';
import monster6 from '@/assets/monsters/monster-6.png';
import monster7 from '@/assets/monsters/monster-7.png';

const monsterImages: Record<number, string> = {
  1: monster1,
  2: monster2,
  3: monster3,
  4: monster4,
  5: monster5,
  6: monster6,
  7: monster7,
};

export function getMonsterImage(monsterId: number): string | undefined {
  return monsterImages[monsterId];
}

export default monsterImages;
