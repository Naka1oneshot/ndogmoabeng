import { motion } from 'framer-motion';
import { Shield, Syringe, AlertTriangle } from 'lucide-react';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import ezkarImage from '@/assets/clans/ezkar.png';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionFullPageClans({ context, replayNonce }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Clan Ezkar
        </h2>
        <p className="text-[#9CA3AF]">
          Le seul clan avec des bonus spéciaux en INFECTION
        </p>
      </div>

      {/* Ezkar card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121A2B] border border-[#D4AF37]/30 rounded-xl overflow-hidden"
      >
        {/* Image */}
        <div className="aspect-video relative overflow-hidden bg-[#0B0E14]">
          <img 
            src={ezkarImage} 
            alt="Clan Ezkar" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121A2B] to-transparent" />
          <div className="absolute bottom-4 left-4">
            <h3 className="text-2xl font-bold text-[#D4AF37]">Ezkar</h3>
            <p className="text-sm text-[#9CA3AF]">Les Gardiens de l'État</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Bonuses */}
          <div className="grid gap-3">
            <div className="flex items-start gap-3 bg-[#0B0E14] rounded-lg p-3">
              <Syringe className="h-6 w-6 text-[#2AB3A6] shrink-0" />
              <div>
                <h4 className="font-semibold text-white">Antidote Ezkar</h4>
                <p className="text-sm text-[#9CA3AF]">
                  Tous les joueurs Ezkar reçoivent un <strong className="text-[#2AB3A6]">Antidote supplémentaire</strong> au début.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-[#0B0E14] rounded-lg p-3">
              <Shield className="h-6 w-6 text-[#D4AF37] shrink-0" />
              <div>
                <h4 className="font-semibold text-white">Gilet Pare-Balles</h4>
                <p className="text-sm text-[#9CA3AF]">
                  Tous les joueurs Ezkar reçoivent un <strong className="text-[#D4AF37]">Gilet</strong> pour se protéger d'un tir.
                </p>
              </div>
            </div>
          </div>

          {/* PV Ezkar special */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧪</span>
              <h4 className="font-semibold text-[#B00020]">PV Ezkar : 2 doses !</h4>
            </div>
            <p className="text-sm text-[#9CA3AF]">
              Un Porte-Venin du clan Ezkar a donc <strong className="text-white">2 antidotes</strong> : 
              celui de son rôle PV + celui de son clan Ezkar.
            </p>
          </motion.div>

          {/* Exception */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-[#E6A23C]/10 border border-[#E6A23C]/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-[#E6A23C]" />
              <h4 className="font-semibold text-[#E6A23C]">Exception importante</h4>
            </div>
            <p className="text-sm text-[#9CA3AF]">
              Si un joueur est <strong className="text-white">clan Ezkar ET rôle KK (Sans Cercle)</strong>,
              son gilet pare-balles <strong className="text-[#E6A23C]">ne le protège pas</strong> contre les tirs.
              <br />
              <span className="text-xs text-[#6B7280]">(Le KK veut mourir pour gagner des PVic)</span>
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-sm text-[#6B7280]"
      >
        <p>Les autres clans (Maison Royale, Akandé, Akila, etc.) n'ont pas de bonus spécifiques en INFECTION.</p>
      </motion.div>
    </div>
  );
}
