import { motion } from 'framer-motion';
import { RulesParagraph, RulesSection } from '@/hooks/useGameRulesContent';
import { AlertTriangle, Info, Lightbulb, List } from 'lucide-react';

interface DynamicRulesRendererProps {
  section: RulesSection;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function ParagraphRenderer({ paragraph }: { paragraph: RulesParagraph }) {
  switch (paragraph.type) {
    case 'text':
      return (
        <p 
          className="text-foreground/80 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: paragraph.text || '' }}
        />
      );
    
    case 'list':
      return (
        <ul className="space-y-2 text-foreground/80">
          {paragraph.items?.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ul>
      );
    
    case 'note':
      return (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p 
            className="text-blue-200 text-sm"
            dangerouslySetInnerHTML={{ __html: paragraph.text || '' }}
          />
        </div>
      );
    
    case 'warning':
      return (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p 
            className="text-amber-200 text-sm"
            dangerouslySetInnerHTML={{ __html: paragraph.text || '' }}
          />
        </div>
      );
    
    case 'example':
      return (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-primary text-sm font-medium">
            <Info className="h-4 w-4" />
            <span>Exemple</span>
          </div>
          <p 
            className="text-foreground/80 text-sm"
            dangerouslySetInnerHTML={{ __html: paragraph.text || '' }}
          />
        </div>
      );
    
    default:
      return null;
  }
}

export function DynamicRulesRenderer({ section, className = '' }: DynamicRulesRendererProps) {
  if (!section.is_visible) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`space-y-4 ${className}`}
    >
      {section.content.map((paragraph, index) => (
        <motion.div key={paragraph.id || index} variants={itemVariants}>
          <ParagraphRenderer paragraph={paragraph} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Hook helper to get a specific section from loaded sections
export function findSection(sections: RulesSection[], sectionKey: string): RulesSection | undefined {
  return sections.find(s => s.section_key === sectionKey);
}

// Helper to get text content from a section by paragraph id
export function getSectionText(section: RulesSection | undefined, paragraphId: string): string {
  if (!section) return '';
  const paragraph = section.content.find(p => p.id === paragraphId);
  return paragraph?.text || '';
}

// Helper to get list items from a section by paragraph id
export function getSectionList(section: RulesSection | undefined, paragraphId: string): string[] {
  if (!section) return [];
  const paragraph = section.content.find(p => p.id === paragraphId);
  return paragraph?.items || [];
}
