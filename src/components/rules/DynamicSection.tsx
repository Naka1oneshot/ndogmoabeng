import { motion } from 'framer-motion';
import { RulesParagraph } from '@/hooks/useGameRulesContent';
import { AlertTriangle, Lightbulb, Info } from 'lucide-react';

interface DynamicSectionProps {
  paragraphs: RulesParagraph[];
  className?: string;
  textClassName?: string;
  listClassName?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function ParagraphRenderer({ 
  paragraph, 
  textClassName = 'text-[#E8E8E8]',
  listClassName = 'text-[#9CA3AF]'
}: { 
  paragraph: RulesParagraph;
  textClassName?: string;
  listClassName?: string;
}) {
  switch (paragraph.type) {
    case 'text':
      return (
        <p 
          className={`leading-relaxed ${textClassName}`}
          dangerouslySetInnerHTML={{ __html: paragraph.text || '' }}
        />
      );
    
    case 'list':
      return (
        <ul className={`space-y-2 ${listClassName}`}>
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

export function DynamicSection({ 
  paragraphs, 
  className = '',
  textClassName,
  listClassName 
}: DynamicSectionProps) {
  if (!paragraphs || paragraphs.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
      className={`space-y-4 ${className}`}
    >
      {paragraphs.map((paragraph, index) => (
        <motion.div key={paragraph.id || index} variants={itemVariants}>
          <ParagraphRenderer 
            paragraph={paragraph} 
            textClassName={textClassName}
            listClassName={listClassName}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Simple text component for single paragraph display
export function DynamicText({ 
  text, 
  className = 'text-[#E8E8E8]' 
}: { 
  text: string; 
  className?: string;
}) {
  if (!text) return null;
  
  return (
    <p 
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}

// Simple list component
export function DynamicList({ 
  items, 
  className = 'text-[#9CA3AF]',
  bulletColor = 'text-primary'
}: { 
  items: string[]; 
  className?: string;
  bulletColor?: string;
}) {
  if (!items || items.length === 0) return null;
  
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className={bulletColor}>•</span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}
