import { Participant, QualityPreset } from '../../types/temple';
import { WorshipperCharacter } from './WorshipperCharacter';

interface CharacterManagerProps {
  participants: Participant[];
  quality: QualityPreset;
}

export function CharacterManager({ participants, quality }: CharacterManagerProps) {
  // Limit shadow casting on characters when congregation grows large to sustain 60fps on M1 8GB
  const allowCharacterShadows = quality === 'high' && participants.length <= 60;

  return (
    <group>
      {participants.map((p) => (
        <WorshipperCharacter
          key={p.userId}
          participant={p}
          castShadows={allowCharacterShadows}
        />
      ))}
    </group>
  );
}
