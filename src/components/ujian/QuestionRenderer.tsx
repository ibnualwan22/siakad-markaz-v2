"use client";

function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function stableShuffle(array: any[], seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i);
  let currentIndex = array.length, randomIndex;
  const result = [...array];
  while (currentIndex !== 0) {
    randomIndex = Math.floor(seededRandom(seed++) * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
  }
  return result;
}

import React, { useState, useEffect } from "react";
import { Grid3X3 } from "lucide-react";
import SoalText from "@/components/soal-text";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface QuestionRendererProps {
  soal: any;
  onAnswer: (payload: { opsiId?: string, jawabanTeks?: string, jawabanData?: any }) => void;
}

const matchColors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'];

function SortableItem({ id, item, isHorizontal, isMatch, index }: { id: string, item: any, isHorizontal?: boolean, isMatch?: boolean, index?: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const borderColor = isMatch && index !== undefined ? matchColors[index % matchColors.length] : undefined;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isMatch ? { borderLeftWidth: '4px', borderLeftColor: borderColor } : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isHorizontal ? { ...attributes, ...listeners } : {})}
      className={`bg-white border-2 border-gray-200 rounded-xl ${isHorizontal ? 'cursor-grab active:cursor-grabbing' : ''} shadow-sm transition-colors z-10 relative flex items-center gap-3
        ${isHorizontal ? 'p-1 justify-center font-serif text-3xl w-14 h-14 md:w-16 md:h-16 shrink-0 text-amber-900 border-amber-200 bg-amber-50 hover:bg-amber-100' : 'p-3 md:p-4 w-full text-left hover:border-blue-300'}`
      }
    >
      {!isHorizontal && !isMatch && index !== undefined && (
         <div className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs select-none shadow-sm">
            {index + 1}
         </div>
      )}
      {!isHorizontal && (
         <div 
           className="text-gray-300 hover:text-gray-500 transition-colors cursor-grab active:cursor-grabbing p-1 md:p-2 -ml-2 select-none touch-none"
           {...attributes}
           {...listeners}
         >
           ☰
         </div>
      )}
      <div className={isHorizontal ? "select-none" : "flex-1 overflow-hidden"}>{item}</div>
    </div>
  );
}

function OrderingComponent({ 
  initialItems, 
  value, 
  onChange,
  isHorizontal = false,
  fixedLefts
}: { 
  initialItems: string[], 
  value?: string[], 
  onChange: (items: string[]) => void,
  isHorizontal?: boolean,
  fixedLefts?: string[]
}) {
  const [items, setItems] = useState(value && value.length === initialItems.length ? value : initialItems);

  useEffect(() => {
    if (!value || value.length === 0) {
      setItems(initialItems);
    }
  }, [value, initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onChange(newItems);
    }
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items}
        strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        <div className={`mt-4 flex ${isHorizontal ? 'flex-row-reverse flex-wrap justify-center gap-3' : 'flex-col gap-3 w-full max-w-2xl'}`}>
          {items.map((item, index) => (
            <div key={item} className={`flex items-stretch ${isHorizontal ? 'gap-2' : ''} ${fixedLefts ? 'w-full gap-0' : 'gap-3'}`}>
               {fixedLefts && fixedLefts[index] && (() => {
                 const color = matchColors[index % matchColors.length];
                 return (
                   <div 
                     className="flex-1 bg-white border border-gray-200 rounded-xl p-4 flex items-center shadow-sm text-gray-700 relative z-10" 
                     style={{ borderRightWidth: '4px', borderRightColor: color }}
                   >
                      <SoalText html={fixedLefts[index]} className="text-sm md:text-base font-medium prose break-words overflow-auto" />
                   </div>
                 );
               })()}
               {fixedLefts && (() => {
                 const color = matchColors[index % matchColors.length];
                 return (
                   <div className="w-8 md:w-16 shrink-0 relative flex flex-col justify-center">
                     <div className="h-[2px] w-[calc(100%+4px)] absolute top-1/2 -left-[2px] -translate-y-1/2 z-0" style={{ backgroundColor: color, opacity: 0.35 }}></div>
                     <div className="w-3 h-3 md:w-4 md:h-4 rounded-full mx-auto relative z-10 shadow-sm border-2 border-white" style={{ backgroundColor: color }}></div>
                   </div>
                 );
               })()}
               <div className={fixedLefts ? "flex-1 relative z-10 min-w-0" : "w-full"}>
                 <SortableItem 
                    id={item} 
                    item={<SoalText html={item} className={`pointer-events-none prose break-words ${isHorizontal ? '' : 'text-sm md:text-base'}`} />} 
                    isHorizontal={isHorizontal} 
                    isMatch={!!fixedLefts}
                    index={index}
                 />
               </div>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

const StabiloSyntaxRenderer = ({ soaldId, dataTambahan, jawabanData, onAnswer }: any) => {
  // active category name (id)
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const categories: any[] = dataTambahan?.categories || [];
  const words: any[] = dataTambahan?.words || [];
  const assignments: Record<string, string> = jawabanData?.assignments || {};

  const handleWordTap = (index: number) => {
    if (!activeCat) return; // No pen selected
    const nextAssignments = { ...assignments };
    const current = nextAssignments[index];
    
    if (current === activeCat) {
      // Toggle off if same color
      delete nextAssignments[index];
    } else {
      // Paint
      nextAssignments[index] = activeCat;
    }
    
    onAnswer({ jawabanData: { ...jawabanData, assignments: nextAssignments } });
  };

  const getStyleForWord = (index: number) => {
    const assignedCat = assignments[index];
    if (!assignedCat) return {};
    const cat = categories.find(c => c.name === assignedCat);
    if (!cat) return {};
    return { backgroundColor: cat.color, color: '#fff', borderColor: 'transparent' };
  };

  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-sm text-gray-500 mb-6 flex flex-col items-center gap-1 font-medium bg-fuchsia-50/50 p-3 rounded-lg border border-fuchsia-100"><span className="bg-fuchsia-100 text-fuchsia-600 px-2 py-0.5 rounded font-bold text-xs shrink-0 tracking-wider">STABILO</span> Pilih warna kategori, lalu sentuh wacana untuk menandainya.</p>

      {/* Teks Wacana */}
      <div className="w-full max-w-3xl flex flex-wrap justify-center gap-2 md:gap-3 p-4 md:p-8 bg-white border border-gray-200 rounded-3xl shadow-sm leading-[3rem]" dir="rtl">
        {words.map((w: any, index: number) => {
           const assignedCat = assignments[index];
           const cat = categories.find(c => c.name === assignedCat);
           const isColorized = !!cat;
           return (
             <button
               key={index}
               onClick={() => handleWordTap(index)}
               className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-serif text-2xl md:text-3xl transition-all duration-300 outline-none transform active:scale-95 shadow-sm filter hover:brightness-110
                 ${isColorized 
                    ? 'font-bold outline-none border-b-4' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                 }
               `}
               style={{
                  backgroundColor: cat ? cat.color : undefined,
                  color: cat ? '#fff' : undefined,
                  borderBottomColor: cat ? 'rgba(0,0,0,0.2)' : undefined,
                  paddingBottom: cat ? '6px' : undefined
               }}
             >
               {w.text}
             </button>
           );
        })}
      </div>

      {/* Palet Warna */}
      <div className="w-full max-w-2xl mt-8 flex flex-wrap justify-center gap-3">
        {categories.map((c: any, i: number) => {
          const isActive = activeCat === c.name;
          return (
            <button
              key={i}
              onClick={() => setActiveCat(c.name)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm outline-none transform
                ${isActive ? '-translate-y-1 ring-4 ring-offset-2 scale-105' : 'hover:-translate-y-1 hover:shadow-md'}
              `}
              style={{
                backgroundColor: c.color,
                color: '#fff',
                borderColor: isActive ? 'transparent' : 'rgba(0,0,0,0.1)',
                borderWidth: isActive ? 0 : 1,
                '--tw-ring-color': isActive ? `${c.color}80` : 'transparent',
              } as React.CSSProperties}
            >
              {c.label || c.name}
            </button>
          )
        })}
      </div>
    </div>
  );
};

const COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308'
];
const getColorStr = (idx: number) => COLORS[idx % COLORS.length];

const JaringRelasiRenderer = ({ dataTambahan, jawabanData, onAnswer }: any) => {
  const leftItems: string[] = dataTambahan?.leftItems || [];
  const rightItems: string[] = dataTambahan?.rightItems || [];
  const connections: { left: number, right: number[] }[] = jawabanData?.connections || [];

  const [activeLeft, setActiveLeft] = useState<number | null>(null);

  const toggleRight = (rightIdx: number) => {
    if (activeLeft === null) return;
    
    let nextConnections = [...connections];
    const connIndex = nextConnections.findIndex(c => c.left === activeLeft);
    
    if (connIndex > -1) {
       const conn = Object.assign({}, nextConnections[connIndex]);
       conn.right = [...conn.right];
       
       if (conn.right.includes(rightIdx)) {
         conn.right = conn.right.filter(r => r !== rightIdx);
         if (conn.right.length === 0) {
           nextConnections.splice(connIndex, 1);
         } else {
           nextConnections[connIndex] = conn;
         }
       } else {
         conn.right.push(rightIdx);
         nextConnections[connIndex] = conn;
       }
    } else {
       nextConnections.push({ left: activeLeft, right: [rightIdx] });
    }

    onAnswer({ jawabanData: { ...jawabanData, connections: nextConnections } });
  };

  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-sm text-gray-500 mb-8 flex flex-col items-center gap-1 font-medium bg-orange-50/50 p-3 rounded-lg border border-orange-100 text-center leading-relaxed">
         <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold text-xs shrink-0 tracking-wider">JARING RELASI</span> 
         Pilih salah satu item di pilar <strong>Kiri</strong>, lalu sentuh dan hubungkan dengan satu atau beberapa item di pilar <strong>Kanan</strong> yang sesuai!
      </p>

      <div className="w-full flex md:flex-row gap-6 md:gap-16 justify-center max-w-4xl px-2">
         {/* Kolom Kiri */}
         <div className="flex-1 max-w-[200px] md:max-w-[300px] shrink-0 flex flex-col gap-3">
            <h4 className="font-bold text-orange-400 text-xs tracking-wider uppercase border-b-2 border-orange-100 pb-2 mb-2 text-right">Pilar Kiri (Asal)</h4>
            {leftItems.map((l, i) => {
              const isActive = activeLeft === i;
              const color = getColorStr(i);
              const conn = connections.find(c => c.left === i);
              const hasConnections = conn && conn.right.length > 0;

              return (
                 <button
                   key={i}
                   onClick={() => setActiveLeft(i)}
                   className={`p-3 md:p-4 rounded-xl text-xl md:text-2xl font-serif text-right shadow-sm border-2 transition-all transform w-full relative outline-none flex items-center justify-end min-h-[4rem]
                      ${isActive ? 'opacity-100 scale-105 z-10' : 'opacity-80 hover:opacity-100 z-0'}`}
                   style={{
                     borderColor: isActive || hasConnections ? color : '#e5e7eb',
                     backgroundColor: isActive ? `${color}10` : '#fff',
                     color: isActive || hasConnections ? color : '#374151',
                     boxShadow: isActive ? `0 4px 12px ${color}30` : undefined,
                   }}
                 >
                   <span dir="auto">{l}</span>
                   {isActive && (
                      <div className="absolute top-1/2 -translate-y-1/2 -left-8 md:-left-12 w-6 md:w-10 h-1 rounded-full transition-all" style={{ backgroundColor: color }}></div>
                   )}
                 </button>
              );
            })}
         </div>

         {/* Kolom Kanan */}
         <div className="flex-1 max-w-[200px] md:max-w-[300px] shrink-0 space-y-3 flex flex-col gap-3">
            <h4 className="font-bold text-orange-400 text-xs tracking-wider uppercase border-b-2 border-orange-100 pb-2 mb-2 text-left">Pilar Kanan (Tujuan)</h4>
            {rightItems.map((r, j) => {
              // Only first left connected visualizer
              const connectedLeftIndices = connections.filter(c => c.right.includes(j)).map(c => c.left);
              const isConnected = connectedLeftIndices.length > 0;
              
              // If active Kiri is one of its connections
              const belongsToActive = activeLeft !== null && connectedLeftIndices.includes(activeLeft);
              
              // Visual color priority: active left color if exists, else first connected color
              const visualLeft = belongsToActive ? activeLeft : (connectedLeftIndices.length > 0 ? connectedLeftIndices[0] : null);
              const color = visualLeft !== null ? getColorStr(visualLeft) : '#e5e7eb';
              
              return (
                 <button
                   key={j}
                   onClick={() => toggleRight(j)}
                   disabled={activeLeft === null && !isConnected}
                   className={`p-3 md:p-4 rounded-xl text-xl md:text-2xl font-serif shadow-sm border-2 transition-all transform w-full relative outline-none text-right flex items-center justify-end min-h-[4rem]
                      ${!isConnected && activeLeft === null ? 'opacity-50 cursor-pointer hover:bg-gray-50' : 'hover:scale-[1.02] active:scale-95 cursor-pointer'}
                      ${belongsToActive ? 'scale-[1.02] !border-4 font-bold z-10' : 'z-0'}`}
                   style={{
                      borderColor: belongsToActive ? color : isConnected ? `${color}80` : '#e5e7eb',
                      backgroundColor: isConnected ? `${color}10` : '#fff',
                      color: isConnected ? color : '#374151',
                   }}
                 >
                   {activeLeft !== null && isConnected && !belongsToActive && (
                     <div className="absolute inset-0 bg-white/70 rounded-lg pointer-events-none transition-all"></div>
                   )}
                   <span dir="auto" className="relative z-10">{r}</span>
                 </button>
              )
            })}
         </div>
      </div>
    </div>
  );
};

export default function QuestionRenderer({ soal, onAnswer }: QuestionRendererProps) {
  const { tipeSoal, opsiList, opsiTerpilih, jawabanTeks, jawabanData, dataTambahan } = soal;

  if (tipeSoal === "PG") {
    // If it's ISIAN but has no options, fallback to ESSAY_SINGKAT below
    if (opsiList && opsiList.length > 0) {
      return (
        <div className="space-y-4">
          {opsiList?.map((opt: any, index: number) => {
            const isSelected = opsiTerpilih === opt.id;
            return (
              <label 
                key={opt.id} 
                className={`flex gap-4 p-4 md:p-5 rounded-2xl cursor-pointer transition-all border-2 group ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-100' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="pt-0.5">
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center text-xs md:text-sm font-bold transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 group-hover:border-blue-400 group-hover:text-blue-500'}`}>
                    {String.fromCharCode(65 + index)}
                  </div>
                </div>
                <div className="flex-1">
                  <input 
                    type="radio" 
                    name={`opsi-${soal.soalId}`} 
                    className="hidden" 
                    checked={isSelected}
                    onChange={() => onAnswer({ opsiId: opt.id })}
                  />
                  <SoalText
                    html={opt.teks}
                    className={`text-sm md:text-base transition-colors block ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`} 
                  />
                  {opt.gambarUrl && (
                    <div className="mt-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={opt.gambarUrl} alt={`Opsi Select`} className="max-w-full max-h-[200px] rounded-lg border border-gray-200 shadow-sm" />
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      );
    }
  }

  if (tipeSoal === "ISIAN_SAMPING" && opsiList && opsiList.length > 0) {
    return (
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-bold text-gray-400 mr-2 uppercase tracking-wide text-[10px]">Opsi:</span>
        {opsiList?.map((opt: any) => {
          const isSelected = opsiTerpilih === opt.id;
          return (
            <label 
              key={opt.id} 
              className={`relative px-4 py-2 rounded-full border-2 font-bold cursor-pointer transition-all active:scale-95 text-sm
                ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
            >
              <input 
                type="radio" 
                name={`opsi-${soal.soalId}`} 
                className="hidden" 
                checked={isSelected}
                onChange={() => onAnswer({ opsiId: opt.id })}
              />
              <span dir="auto" dangerouslySetInnerHTML={{__html: opt.teks.replace(/<[^>]+>/g, '')}} />
            </label>
          );
        })}
      </div>
    );
  }

  if (tipeSoal === "ISIAN_BAWAH" && opsiList && opsiList.length > 0) {
    return (
      <div className="mt-6 border-t border-gray-100 pt-6">
        <p className="text-sm text-gray-500 mb-4 font-medium flex items-center gap-2">
           <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold tracking-wider">BANK KATA</span> 
           Pilih jawaban yang paling tepat untuk mengisi bagian rumpang:
        </p>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {opsiList?.map((opt: any) => {
            const isSelected = opsiTerpilih === opt.id;
            return (
              <label 
                key={opt.id} 
                className={`relative px-4 py-2.5 rounded-xl border-2 font-bold cursor-pointer transition-all active:scale-95 shadow-sm text-sm md:text-base cursor-pointer
                  ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200 shadow-md transform -translate-y-0.5' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'}`}
              >
                <input 
                  type="radio" 
                  name={`opsi-${soal.soalId}`} 
                  className="hidden" 
                  checked={isSelected}
                  onChange={() => onAnswer({ opsiId: opt.id })}
                />
                <span dir="auto" dangerouslySetInnerHTML={{__html: opt.teks}} />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipeSoal === "MUFRODAT" && opsiList && opsiList.length > 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 mb-2 font-medium">Pilih salah satu kosakata yang paling tepat:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {opsiList?.map((opt: any) => {
            const isSelected = opsiTerpilih === opt.id;
            return (
              <label 
                key={opt.id} 
                className={`relative p-3 rounded-2xl cursor-pointer text-center transition-all border-2 group shadow-sm active:scale-95 ${isSelected ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200' : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'}`}
              >
                <input 
                  type="radio" 
                  name={`opsi-${soal.soalId}`} 
                  className="hidden" 
                  checked={isSelected}
                  onChange={() => onAnswer({ opsiId: opt.id })}
                />
                <div className={`text-base md:text-lg font-bold font-serif mb-1 block`} dir="auto" dangerouslySetInnerHTML={{__html: opt.teks}}></div>
                {opt.gambarUrl && (
                  <div className="mt-2 text-center flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={opt.gambarUrl} alt="Kosakata" className="max-w-full h-16 object-contain rounded border border-gray-100 bg-gray-50" />
                  </div>
                )}
                {isSelected && (
                   <div className="absolute top-1 right-1 w-4 h-4 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-sm">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                   </div>
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipeSoal === "BENAR_SALAH" && opsiList && opsiList.length > 0) {
    return (
      <div className="space-y-4">
         <p className="text-sm text-gray-500 mb-2 font-medium">Tentukan apakah pernyataan di atas Benar atau Salah:</p>
         <div className="flex gap-4">
           {opsiList?.map((opt: any) => {
             const isSelected = opsiTerpilih === opt.id;
             // Try to determine if this option represents "Benar" or "Salah"
             const isBenarOpt = opt.teks.toLowerCase().includes("benar") || opt.teks.toLowerCase().includes("صحيح");
             const isSalahOpt = opt.teks.toLowerCase().includes("salah") || opt.teks.toLowerCase().includes("خطأ");
             
             let activeColor = 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200';
             let hoverColor = 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-700';
             let icon = null;
             
             if (isBenarOpt) {
                activeColor = 'bg-green-600 border-green-600 text-white ring-2 ring-green-200';
                hoverColor = 'hover:bg-green-50 hover:border-green-300 hover:text-green-700 text-gray-700';
                icon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
             } else if (isSalahOpt) {
                activeColor = 'bg-rose-600 border-rose-600 text-white ring-2 ring-rose-200';
                hoverColor = 'hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-gray-700';
                icon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
             }

             return (
               <label 
                 key={opt.id} 
                 className={`flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-3xl cursor-pointer transition-all border-2 shadow-sm active:scale-95 ${isSelected ? activeColor : `bg-white border-gray-200 ${hoverColor}`}`}
               >
                 <input 
                   type="radio" 
                   name={`opsi-${soal.soalId}`} 
                   className="hidden" 
                   checked={isSelected}
                   onChange={() => onAnswer({ opsiId: opt.id })}
                 />
                 {icon && <div className={`mb-1 ${isSelected ? 'opacity-100' : 'opacity-40'}`}>{icon}</div>}
                 <SoalText
                   html={opt.teks}
                   className={`text-lg md:text-xl font-bold transition-colors block leading-none`} 
                 />
               </label>
             );
           })}
         </div>
      </div>
    );
  }

  if (tipeSoal === "PG_MULTI") {
    const selectedIds = jawabanData?.selectedIds || [];
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 mb-3 items-center gap-2 flex"><span className="bg-blue-100 text-blue-600 p-1 px-2 rounded font-bold text-xs">INFO</span> Anda dapat memilih lebih dari satu jawaban (Checkbox).</p>
        {opsiList?.map((opt: any, index: number) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <label 
              key={opt.id} 
              className={`flex gap-4 p-4 md:p-5 rounded-2xl cursor-pointer transition-all border-2 group ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-100' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              <div className="pt-0.5">
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-md border-2 flex items-center justify-center text-xs md:text-sm font-bold transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 group-hover:border-blue-400 group-hover:text-blue-500'}`}>
                  {isSelected ? '✓' : ''}
                </div>
              </div>
              <div className="flex-1">
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={isSelected}
                  onChange={(e) => {
                    let newSelected = [...selectedIds];
                    if (e.target.checked) newSelected.push(opt.id);
                    else newSelected = newSelected.filter((id: string) => id !== opt.id);
                    onAnswer({ jawabanData: { selectedIds: newSelected } });
                  }}
                />
                <SoalText
                  html={opt.teks}
                  className={`text-sm md:text-base transition-colors block ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`} 
                />
                {opt.gambarUrl && (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={opt.gambarUrl} alt={`Opsi Checkbox`} className="max-w-full max-h-[200px] rounded-lg border border-gray-200 shadow-sm" />
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    );
  }

  if (["ESSAY_SINGKAT", "ESSAY_ARAB", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(tipeSoal)) {
    return (
      <div className="mt-4">
        <DebouncedTextInput
          key={soal.soalId}
          initialValue={jawabanTeks || ""}
          onSave={(val: string) => onAnswer({ jawabanTeks: val })}
          placeholder="Ketik jawaban Anda di sini..."
          className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition"
        />
      </div>
    );
  }

  if (["ESSAY_PANJANG", "ESSAY_GAMBAR"].includes(tipeSoal)) {
    return (
      <div className="mt-4">
        <DebouncedTextInput
          key={soal.soalId}
          isTextarea={true}
          initialValue={jawabanTeks || ""}
          onSave={(val: string) => onAnswer({ jawabanTeks: val })}
          placeholder="Ketik jawaban essay panjang Anda di sini..."
          className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition resize-y"
        />
        <div className="text-right mt-1 text-xs text-gray-400 font-medium">
          {jawabanTeks?.length || 0} karakter
        </div>
      </div>
    );
  }

  if (tipeSoal === "PARAGRAF_RUMPANG") {
    const paragraf: string = dataTambahan?.paragraf || "";
    const blanks: any[] = dataTambahan?.blanks || [];
    const answers: Record<string, string> = jawabanData?.answers || {};
    
    // Pecah paragraf menggunakan token {{N}}
    const parts = paragraf.split(/(\{\{\d+\}\})/g);
    
    return (
      <div className="mt-6 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg md:text-xl leading-loose" dir="auto">
        {parts.map((part, i) => {
          const match = part.match(/\{\{(\d+)\}\}/);
          if (match) {
            const idxStr = match[1];
            return (
              <input
                key={i}
                type="text"
                dir="auto"
                value={answers[idxStr] || ""}
                onChange={(e) => {
                   onAnswer({ jawabanData: { ...jawabanData, answers: { ...answers, [idxStr]: e.target.value } } });
                }}
                className="mx-2 px-3 py-1 bg-gray-50 border-b-2 border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors w-24 md:w-32 text-center text-blue-700 font-bold font-sans"
              />
            );
          }
          return <span key={i} className="font-serif">{part}</span>;
        })}
      </div>
    );
  }

  if (tipeSoal === "STABILO_SYNTAX") {
    return <StabiloSyntaxRenderer 
      soaldId={soal.soalId} 
      dataTambahan={dataTambahan} 
      jawabanData={jawabanData} 
      onAnswer={onAnswer} 
    />;
  }

  if (tipeSoal === "JARING_RELASI") {
    return <JaringRelasiRenderer 
      dataTambahan={dataTambahan} 
      jawabanData={jawabanData} 
      onAnswer={onAnswer} 
    />;
  }

  if (tipeSoal === "DRAG_TO_BLANK") {
    const paragraf: string = dataTambahan?.paragraf || "";
    const wordBank: string[] = dataTambahan?.wordBank || [];
    const answers: Record<string, string> = jawabanData?.answers || {};
    
    // Pecah paragraf menggunakan token {{N}}
    const parts = paragraf.split(/(\{\{\d+\}\})/g);
    
    const blankIndices = parts
      .map(p => {
         const m = p.match(/\{\{(\d+)\}\}/);
         return m ? m[1] : null;
      })
      .filter(Boolean) as string[];

    const handleTapBank = (word: string) => {
       const availableCount = wordBank.filter(w => w === word).length;
       const usedCount = Object.values(answers).filter(w => w === word).length;
       if (usedCount >= availableCount) return; 

       const firstEmpty = blankIndices.find(idx => !answers[idx]);
       if (!firstEmpty) return; 
       
       onAnswer({ jawabanData: { ...jawabanData, answers: { ...answers, [firstEmpty]: word } } });
    };

    const handleTapHole = (idxStr: string) => {
       if (!answers[idxStr]) return;
       const next = { ...answers };
       delete next[idxStr];
       onAnswer({ jawabanData: { ...jawabanData, answers: next } });
    };

    return (
      <div className="mt-6">
        <p className="text-sm text-gray-500 mb-4 flex items-center gap-2"><span className="bg-cyan-100 text-cyan-700 p-1 px-2 rounded font-bold text-xs shrink-0">INFO</span> Ketuk kata dari kotak bank kata (di bawah) untuk mengisi bagian paragraf yang kosong.</p>
        
        {/* TextBox Area */}
        <div className="p-6 bg-cyan-50/20 border-2 border-cyan-100 rounded-3xl shadow-inner leading-[3.5rem] md:leading-[4.5rem]" dir="auto">
          {parts.map((part, i) => {
            const match = part.match(/\{\{(\d+)\}\}/);
            if (match) {
              const idxStr = match[1];
              const isFilled = !!answers[idxStr];
              return (
                <button
                  key={i}
                  onClick={() => handleTapHole(idxStr)}
                  className={`mx-2 min-w-[5rem] px-4 py-2 font-serif text-xl md:text-2xl rounded-xl transition-all border-b-4 focus:outline-none align-middle
                    ${isFilled 
                       ? 'bg-cyan-100 border-cyan-400 text-cyan-900 shadow-sm active:scale-95 font-bold' 
                       : 'bg-gray-100 border-gray-300 text-transparent border-dashed cursor-default active:bg-gray-200'}`}
                >
                  {isFilled ? answers[idxStr] : '...'}
                </button>
              );
            }
            return <span key={i} className="font-serif text-xl md:text-2xl text-gray-800">{part}</span>;
          })}
        </div>

        {/* Word Bank Area */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap justify-center gap-3" dir="rtl">
          {(() => {
             const usedAnswers = [...Object.values(answers)];
             return wordBank.map((w, i) => {
                const usedIndex = usedAnswers.indexOf(w);
                const isSelected = usedIndex > -1;
                if (isSelected) {
                   usedAnswers.splice(usedIndex, 1); 
                }
                return (
                   <button
                     key={i}
                     disabled={isSelected}
                     onClick={() => handleTapBank(w)}
                     className={`px-4 py-3 rounded-xl text-xl font-serif transition-colors duration-200 shadow-[0_4px_0_var(--tw-shadow-color)] active:shadow-none active:translate-y-1 font-bold
                       ${isSelected 
                          ? 'bg-gray-100 text-transparent border-gray-200 shadow-transparent pointer-events-none' 
                          : 'bg-white text-cyan-900 border-2 border-cyan-200 hover:bg-cyan-50 shadow-cyan-200'
                       }
                     `}
                   >
                     {w}
                   </button>
                );
             });
          })()}
        </div>
      </div>
    );
  }

  if (tipeSoal === "IDENTIFIKASI_KESALAHAN") {
    const segments: any[] = dataTambahan?.segments || [];
    const selectedIndices: number[] = jawabanData?.selectedIndices || [];

    return (
      <div className="mt-6">
        <p className="text-sm text-gray-500 mb-4 flex items-center gap-2"><span className="bg-amber-100 text-amber-600 p-1 px-2 rounded font-bold text-xs shrink-0">INFO</span> Sentuh / klik pada bagian kata yang mengandung kesalahan tata bahasa (Grammar).</p>
        <div className="flex flex-wrap gap-2 md:gap-3 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-inner justify-center" dir="auto">
          {segments.map((seg, i) => {
             const isSelected = selectedIndices.includes(i);
             return (
               <button
                 key={i}
                 onClick={() => {
                    let nextSelected = [...selectedIndices];
                    if (isSelected) {
                       nextSelected = nextSelected.filter(n => n !== i);
                    } else {
                       nextSelected.push(i);
                    }
                    onAnswer({ jawabanData: { ...jawabanData, selectedIndices: nextSelected } });
                 }}
                 className={`px-4 py-3 rounded-xl border-2 text-xl md:text-2xl transition-all shadow-sm font-serif
                   ${isSelected ? 'bg-rose-100 border-rose-400 text-rose-700 font-bold scale-105' : 'bg-white border-blue-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50'}`}
               >
                 {seg.text}
               </button>
             );
          })}
        </div>
      </div>
    );
  }

  if (tipeSoal === "TABEL_TASRIF") {
    const headers: string[] = dataTambahan?.headers || [];
    const rows: any[] = dataTambahan?.rows || [];
    const answers: Record<string, string> = jawabanData?.cells || {};

    return (
      <TabelMatrixWrapper>
        {(zoom: number) => (
          <>
            <p className="text-sm text-gray-500 mb-2 self-start flex items-center gap-2"><span className="bg-amber-100 text-amber-600 p-1 px-2 rounded font-bold text-xs shrink-0">INFO</span> Ketik isian yang tepat pada sel matriks tabel yang masih kosong.</p>
            <p className="text-xs text-amber-600 mb-4 self-start flex items-center gap-1 font-semibold md:hidden">👆 Gunakan tombol zoom (+/−). Geser tabel ke kiri/kanan ↔ jika tidak muat di layar.</p>
            <div className="w-full overflow-x-auto overflow-y-visible pb-[40vh] scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="min-w-[600px]" style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }}>
                <table className="w-full text-center border-collapse text-sm md:text-base border border-amber-200 shadow-sm rounded-xl overflow-hidden" dir="rtl">
                  <thead className="bg-amber-100/80 text-amber-900 border-b border-amber-200">
                    <tr>
                      <th className="p-3"></th>
                      {headers.map((h, i) => (
                        <th key={i} className="p-3 font-bold border-r border-amber-200/50 min-w-[80px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-amber-100 last:border-none bg-white hover:bg-amber-50/30 transition-colors">
                        <td className="p-3 font-bold text-amber-900 border-l border-amber-200/50 bg-amber-50/20">{row.label}</td>
                        {row.cells.map((cell: any, cIdx: number) => {
                          const key = `${rIdx}-${cIdx}`;
                          return (
                            <td key={cIdx} className="p-2 border-r border-amber-100 align-middle min-w-[100px]">
                              {cell.isBlank ? (
                                <input
                                  type="text"
                                  dir="auto"
                                  value={answers[key] || ""}
                                  onChange={(e) => {
                                     onAnswer({ jawabanData: { ...jawabanData, cells: { ...answers, [key]: e.target.value } } });
                                  }}
                                  onFocus={(e) => {
                                     // Scroll into view with extra delay for keyboard animation
                                     setTimeout(() => {
                                       e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                     }, 400);
                                  }}
                                  className="w-full min-w-[90px] p-2 bg-amber-50/50 border-2 border-amber-200 focus:border-amber-500 focus:bg-white rounded-lg outline-none text-center font-bold text-amber-900 transition-colors shadow-inner"
                                />
                              ) : (
                                <span className="font-serif text-xl md:text-2xl text-gray-800 py-2 inline-block">{cell.value.split('|')[0].trim()}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </TabelMatrixWrapper>
    );
  }

  if (tipeSoal === "SUSUN_HURUF") {
    const hurufAcak: string[] = dataTambahan?.hurufAcak || [];
    const susunanIndices: number[] = jawabanData?.susunanIndices || [];
    
    // Derived values
    const currentSusunan = susunanIndices.map(idx => hurufAcak[idx]);
    
    const isSelected = (idx: number) => susunanIndices.includes(idx);
    
    const handleTapHuruf = (idx: number) => {
      if (isSelected(idx)) return; // Already selected
      onAnswer({ jawabanData: { ...jawabanData, susunanIndices: [...susunanIndices, idx] } });
    };

    const handleTapSusunan = () => {
      // pop last
      if (susunanIndices.length === 0) return;
      const next = [...susunanIndices];
      next.pop();
      onAnswer({ jawabanData: { ...jawabanData, susunanIndices: next } });
    };

    const handleReset = () => {
      onAnswer({ jawabanData: { ...jawabanData, susunanIndices: [] } });
    };

    return (
      <div className="mt-6 flex flex-col items-center">
        <div className="w-full font-sans mb-8">
          <p className="text-sm font-bold text-indigo-800 bg-indigo-50 border border-indigo-100 p-3 rounded-lg block">
            👇 Susunlah urutan huruf / kata di bawah ini hingga benar!
          </p>
        </div>

        {/* Area Susunan (Target) */}
        <div 
          onClick={handleTapSusunan}
          className="w-full max-w-xl min-h-[5rem] p-4 bg-gray-50 border-2 border-dashed border-indigo-300 rounded-2xl flex flex-wrap gap-2 justify-center items-center shadow-inner cursor-pointer hover:bg-gray-100 transition-colors select-none" 
          dir="rtl"
          title="Ketuk untuk membatalkan item terakhir"
        >
          {currentSusunan.length === 0 ? (
            <span className="text-indigo-300 font-bold text-sm">Pilih di bawah...</span>
          ) : (
            currentSusunan.map((h, i) => (
              <span key={i} className="px-4 py-3 bg-indigo-600 text-white border-b-4 border-indigo-800 rounded-xl text-2xl md:text-3xl font-serif shadow-sm transform transition-all">{h}</span>
            ))
          )}
        </div>

        {/* Area Chip Acak */}
        <div className="w-full max-w-xl mt-6 md:mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-3 justify-center select-none" dir="rtl">
          {hurufAcak.map((h, i) => {
             const selected = isSelected(i);
             return (
               <button
                 key={i}
                 disabled={selected}
                 onClick={() => handleTapHuruf(i)}
                 className={`px-4 py-3 min-w-[3rem] rounded-xl text-2xl md:text-3xl font-serif transition-all duration-200 transform font-bold
                   ${selected 
                      ? 'bg-gray-100 text-gray-300 border-2 border-gray-100 scale-95 shadow-none' 
                      : 'bg-white text-indigo-900 border-2 border-indigo-200 shadow-[0_4px_0_theme(colors.indigo.200)] hover:-translate-y-1 hover:shadow-[0_6px_0_theme(colors.indigo.200)] active:translate-y-0 active:shadow-none'
                   }
                 `}
               >
                 {h}
               </button>
             );
          })}
        </div>
        
        {susunanIndices.length > 0 && (
          <button onClick={handleReset} className="mt-8 px-4 py-2 bg-rose-50 text-rose-600 font-bold text-xs rounded-full hover:bg-rose-100 transition-colors uppercase tracking-wider flex items-center gap-1 shadow-sm">
             ⟲ Ulangi (Reset)
          </button>
        )}
      </div>
    );
  }

  if (tipeSoal === "MENGURUTKAN") {
    const items = dataTambahan?.items || [];
    const currentItems = jawabanData?.items || [];
    
    // Map currentItems to ordered list, or shuffle deterministically if pristine
    let orderedItems = [...items];
    if (currentItems.length === items.length) {
       orderedItems = currentItems;
    } else {
       orderedItems = stableShuffle(items, soal.soalId);
    }

    return (
      <div className="mt-4">
        <p className="text-sm text-gray-500 mb-3 items-center gap-2 flex"><span className="bg-blue-100 text-blue-600 p-1 px-2 rounded font-bold text-xs">INFO</span> Tahan dan geser kotak di bawah ini untuk mengurutkan posisi sesuai jawaban yang benar.</p>
        <OrderingComponent 
          key={soal.soalId}
          initialItems={orderedItems} 
          value={currentItems} 
          onChange={(newItems) => onAnswer({ jawabanData: { items: newItems } })}
        />
      </div>
    );
  }

function TapAndConnectComponent({ 
  lefts, 
  rights, 
  value, 
  onChange 
}: { 
  lefts: string[], 
  rights: string[], 
  value: { left: string, right: string }[], 
  onChange: (pairs: { left: string, right: string }[]) => void 
}) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);

  // Initialize first empty slot automatically if none is active
  useEffect(() => {
    if (activeLeft === null && value.length < lefts.length) {
      const firstEmpty = lefts.findIndex(l => !value.some(p => p.left === l));
      if (firstEmpty !== -1) setActiveLeft(firstEmpty);
    }
  }, [activeLeft, value, lefts]);

  const handleLeftClick = (index: number) => {
    const leftItem = lefts[index];
    const hasPair = value.some(p => p.left === leftItem);
    
    if (hasPair) {
      // Clear pair and make active
      onChange(value.filter(p => p.left !== leftItem));
      setActiveLeft(index);
    } else {
      setActiveLeft(activeLeft === index ? null : index);
    }
  };

  const handleRightClick = (rightItem: string) => {
    let focusIndex = activeLeft;
    if (focusIndex === null) {
      const emptyIndex = lefts.findIndex(l => !value.some(p => p.left === l));
      if (emptyIndex !== -1) focusIndex = emptyIndex;
      else return; // All full
    }
    
    const leftItem = lefts[focusIndex];
    // Remove if rightItem is linked elsewhere, or leftItem is already linked
    const newPairs = value.filter(p => p.left !== leftItem && p.right !== rightItem);
    newPairs.push({ left: leftItem, right: rightItem });
    onChange(newPairs);
    
    // Auto advance to next empty slot
    const nextEmpty = lefts.findIndex(l => l !== leftItem && !newPairs.some(p => p.left === l));
    setActiveLeft(nextEmpty !== -1 ? nextEmpty : null);
  };

  return (
    <div className="flex flex-col gap-5 mt-4 w-full max-w-2xl">
      <div className="grid gap-3 w-full">
         {lefts.map((l, idx) => {
            const pairedRight = value.find(p => p.left === l)?.right;
            const color = matchColors[idx % matchColors.length];
            const isActive = activeLeft === idx;
            return (
              <div 
                key={idx} 
                onClick={() => handleLeftClick(idx)}
                className={`flex flex-col md:flex-row items-stretch border-2 rounded-2xl cursor-pointer transition-all ${isActive ? 'ring-4 ring-indigo-300 border-indigo-400 scale-[1.02] shadow-md relative z-10' : 'border-gray-200 hover:border-indigo-200 bg-white shadow-sm'}`}
              >
                 <div className="flex-1 p-3 md:p-4 flex items-center justify-center border-b-2 md:border-b-0 md:border-r-2" style={{ borderColor: color }}>
                    <SoalText html={l} className="text-sm md:text-base font-medium prose break-words" />
                 </div>
                 <div className={`flex-1 p-3 md:p-4 flex items-center justify-center transition-colors ${pairedRight ? 'bg-indigo-50/50' : (isActive ? 'bg-indigo-50 animate-pulse' : 'bg-gray-50')}`}>
                    {pairedRight ? (
                      <SoalText html={pairedRight} className="text-base font-bold text-indigo-900 prose break-words" />
                    ) : (
                      <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {isActive ? '↓ Pilih jawaban di bawah ↓' : 'Ketuk untuk mengisi...'}
                      </span>
                    )}
                 </div>
              </div>
            );
         })}
      </div>
      
      {/* Option Bank */}
      <div className="mt-4 border-t-2 border-dashed border-gray-200 pt-6">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Grid3X3 size={16} /> Bank Opsi Jawaban:
        </h4>
        <div className="flex flex-wrap gap-3 justify-center" dir="rtl">
           {rights.map((r, idx) => {
              const isUsed = value.some(p => p.right === r);
              if (isUsed) return null; // Hide used options
              return (
                 <button 
                   key={idx} 
                   onClick={() => handleRightClick(r)} 
                   disabled={activeLeft === null && value.length === lefts.length}
                   className={`p-3 px-5 bg-white border-2 border-indigo-200 text-indigo-900 rounded-xl shadow-sm transition-all transform hover:-translate-y-1 hover:shadow-md active:scale-95 ${activeLeft === null && value.length === lefts.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                    <SoalText html={r} className="text-base font-medium pointer-events-none" />
                 </button>
              );
           })}
           {rights.every(r => value.some(p => p.right === r)) && (
             <div className="w-full text-center p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 font-bold text-sm">
               Semua pasangan sudah terisi! ✅
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

// ================= ORIGINAL QUESTION RENDERER =================

  if (tipeSoal === "MENJODOHKAN") {
    const lefts = dataTambahan?.lefts || [];
    let rights = dataTambahan?.rights || [];
    const currentPairs = jawabanData?.pairs || [];
    
    // Map currentPairs to ordered rights list, or shuffle deterministically if pristine
    let orderedRights = [...rights];
    if (currentPairs.length === lefts.length) {
       orderedRights = currentPairs.map((p: any) => p.right);
    } else {
       orderedRights = stableShuffle(rights, soal.soalId);
    }

    return (
      <div className="mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 shadow-sm">
          <p className="text-sm text-blue-800 items-start gap-2 flex">
            <span className="bg-blue-200 text-blue-700 p-1 px-2 rounded font-bold text-xs shrink-0 mt-0.5">INFO</span> 
            <span>Untuk memindahkan blok jawaban pada HP, <strong>sentuh dan tahan</strong> pada <strong>ikon garis tiga ( ☰ )</strong> di pojok kanan blok, lalu geser ke atas/bawah agar sejajar dengan pertanyaan yang tepat.</span>
          </p>
        </div>
        <div className="flex font-bold text-gray-400 text-xs tracking-wider mb-2 max-w-2xl px-2 uppercase">
           <div className="flex-1">Kolom A (Tetap)</div>
           <div className="px-5"></div>
           <div className="flex-1">Kolom B (Geser)</div>
        </div>
        <OrderingComponent 
          key={soal.soalId}
          initialItems={orderedRights} 
          value={orderedRights} 
          onChange={(newItems) => {
             const newPairs = lefts.map((l: string, idx: number) => ({ left: l, right: newItems[idx] }));
             onAnswer({ jawabanData: { pairs: newPairs } });
          }}
          fixedLefts={lefts}
        />
      </div>
    );
  }

  if (tipeSoal === "DRAG_KATEGORI") {
    const categories = dataTambahan?.categories || [];
    const items = dataTambahan?.items || [];
    const savedItems = jawabanData?.items || [];

    // Simple fallback UI for categorizing without DND (using intuitive select buttons per item)
    // Mobile friendly and accessible
    return (
      <div className="mt-4 space-y-4">
         <p className="text-sm text-gray-500 items-center gap-2 flex"><span className="bg-blue-100 text-blue-600 p-1 px-2 rounded font-bold text-xs">INFO</span> Pilih kategori yang tepat untuk masing-masing item di bawah ini.</p>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {items.map((item: any, idx: number) => {
             const selectedCat = savedItems.find((s: any) => s.text === item.text)?.category;
             return (
               <div key={idx} className={`p-4 border-2 rounded-xl transition-colors ${selectedCat ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                  <SoalText html={item.text} className="text-base font-medium mb-3 block" />
                  <div className="flex flex-wrap gap-2">
                     {categories.map((cat: string) => {
                        const isSelected = selectedCat === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => {
                               const newSavedItems = savedItems.filter((s:any) => s.text !== item.text);
                               newSavedItems.push({ text: item.text, category: cat });
                               onAnswer({ jawabanData: { items: newSavedItems } });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all active:scale-95 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                          >
                             {cat}
                          </button>
                        )
                     })}
                  </div>
               </div>
             )
           })}
         </div>
      </div>
    );
  }
  
  if (tipeSoal === "KITABAH") {
    const huruf = dataTambahan?.huruf || [];
    return (
      <div className="mt-4">
        <p className="text-sm text-gray-500 mb-3 text-right" dir="rtl">اسحب ورتب الحروف لتكون الكلمة الصحيحة.</p>
        <OrderingComponent 
          initialItems={huruf} 
          value={jawabanTeks ? jawabanTeks.split('') : undefined} 
          onChange={(newItems) => onAnswer({ jawabanTeks: newItems.join('') })}
          isHorizontal={true}
        />
      </div>
    );
  }

  // Fallback if not recognized yet
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 font-bold">
      Jenis soal &quot;{tipeSoal}&quot; sedang dalam tahap pengembangan di antarmuka ini.
    </div>
  );
}

function DebouncedTextInput({ initialValue, onSave, placeholder, className, isTextarea = false }: any) {
  const [val, setVal] = React.useState(initialValue || "");
  const saveTimeout = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    // Only update internal state if the new prop diffs the stored payload
    // and they aren't actively typing.
    if (initialValue !== val && document.activeElement !== document.getElementById("debounced-input")) {
      setVal(initialValue || "");
    }
  }, [initialValue]);

  const handleChange = (e: any) => {
    const newVal = e.target.value;
    setVal(newVal);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onSave(newVal);
    }, 500);
  };

  const handleBlur = (e: any) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    onSave(e.target.value);
  };

  if (isTextarea) {
    return (
      <textarea
        id="debounced-input"
        value={val}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        dir="auto"
        rows={6}
      />
    );
  }

  return (
    <input
      id="debounced-input"
      type="text"
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      dir="auto"
    />
  );
};

function TabelMatrixWrapper({ children }: { children: (zoom: number) => React.ReactNode }) {
  const [zoom, setZoom] = React.useState(1);

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.15, 1.8));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.5));
  const zoomReset = () => setZoom(1);

  return (
    <div className="mt-6 flex flex-col items-center relative">
      {/* Zoom Controls */}
      <div className="sticky top-2 z-10 self-end flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-amber-200 rounded-full px-2 py-1 shadow-lg mb-3">
        <button onClick={zoomOut} className="w-8 h-8 flex items-center justify-center text-amber-700 hover:bg-amber-100 rounded-full font-bold text-base transition-colors" title="Perkecil">−</button>
        <button onClick={zoomReset} className="px-2 h-8 flex items-center justify-center text-amber-700 hover:bg-amber-100 rounded-full font-bold text-xs transition-colors" title="Reset zoom">{Math.round(zoom * 100)}%</button>
        <button onClick={zoomIn} className="w-8 h-8 flex items-center justify-center text-amber-700 hover:bg-amber-100 rounded-full font-bold text-base transition-colors" title="Perbesar">+</button>
      </div>
      {children(zoom)}
    </div>
  );
}
