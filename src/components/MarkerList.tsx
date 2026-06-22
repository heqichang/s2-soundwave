import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import { MARKER_COLORS, type Marker } from "@/types/editor";
import { Flag, Pencil, Trash2, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import clsx from "clsx";

interface MarkerListProps {
  onJumpTo?: (time: number) => void;
}

function formatMarkerTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 1000);
  return `${mins}:${wholeSecs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export default function MarkerList({ onJumpTo }: MarkerListProps) {
  const {
    markers,
    addMarker,
    updateMarker,
    removeMarker,
    clearMarkers,
  } = useEditorStore();
  const { currentTime, duration, waveformData } = usePlayerStore();

  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  const hasData = waveformData.length > 0;

  const handleAddMarker = () => {
    if (!hasData) return;
    const colorIdx = markers.length % MARKER_COLORS.length;
    addMarker({
      time: currentTime || 0,
      name: `标记 ${markers.length + 1}`,
      color: MARKER_COLORS[colorIdx],
    });
  };

  const handleStartEdit = (marker: Marker) => {
    setEditingId(marker.id);
    setEditName(marker.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editingId === id) {
      updateMarker(id, { name: editName.trim() || "未命名" });
      setEditingId(null);
      setEditName("");
    }
  };

  const handlePickColor = (id: string, color: string) => {
    updateMarker(id, { color });
    setShowColorPicker(null);
  };

  const handleJump = (time: number) => {
    onJumpTo?.(time);
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div
        className={clsx(
          "flex items-center justify-between px-4 py-3 cursor-pointer",
          "border-b border-surface-700/40 hover:bg-surface-700/20 transition-colors",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Flag size={14} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-surface-100">标记</h3>
          <span className="text-[10px] font-mono text-surface-500 px-1.5 py-0.5 rounded bg-surface-700/40">
            {markers.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddMarker();
            }}
            disabled={!hasData}
            className={clsx(
              "px-2 py-1 rounded-lg text-xs font-medium transition-all",
              hasData
                ? "bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 border border-brand-500/30"
                : "bg-surface-700/40 text-surface-500 cursor-not-allowed border border-surface-700/40",
            )}
            title="添加标记 (M)"
          >
            + 添加
          </button>
          {markers.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearMarkers();
              }}
              className="px-2 py-1 rounded-lg text-xs font-medium bg-surface-700/40 text-surface-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="清除全部标记"
            >
              清除
            </button>
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-surface-500" />
          ) : (
            <ChevronDown size={14} className="text-surface-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="max-h-60 overflow-y-auto">
          {markers.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-surface-500">暂无标记</p>
              <p className="text-[10px] text-surface-600 mt-1">
                按 M 键或点击「+ 添加」在当前位置插入标记
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-surface-700/30">
              {markers.map((marker, idx) => (
                <li
                  key={marker.id}
                  className="group px-3 py-2 flex items-center gap-2 hover:bg-surface-700/20 transition-colors"
                >
                  <div className="relative">
                    <button
                      type="button"
                      className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-surface-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: marker.color }}
                      onClick={() =>
                        setShowColorPicker(showColorPicker === marker.id ? null : marker.id)
                      }
                      title="更改颜色"
                    />
                    {showColorPicker === marker.id && (
                      <div
                        className="absolute z-20 left-0 top-6 p-1.5 rounded-lg bg-surface-800 border border-surface-700 shadow-xl flex flex-wrap gap-1 w-36"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {MARKER_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={clsx(
                              "w-5 h-5 rounded-md border transition-all",
                              c === marker.color
                                ? "border-white ring-2 ring-brand-400"
                                : "border-surface-600 hover:border-surface-400",
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => handlePickColor(marker.id, c)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-surface-500 w-4 text-right">
                    {idx + 1}.
                  </span>

                  {editingId === marker.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveEdit(marker.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(marker.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditName("");
                        }
                      }}
                      autoFocus
                      className="flex-1 px-1.5 py-0.5 rounded bg-surface-800 border border-brand-400/60 text-xs text-surface-100 font-mono focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="flex-1 text-xs text-surface-200 font-medium truncate cursor-text"
                      onClick={() => handleStartEdit(marker)}
                      title="点击重命名"
                    >
                      {marker.name}
                    </span>
                  )}

                  <span className="text-[10px] font-mono text-surface-400 px-1.5 py-0.5 rounded bg-surface-700/30">
                    {formatMarkerTime(marker.time)}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleJump(marker.time)}
                      className="p-1 rounded hover:bg-brand-500/20 text-surface-400 hover:text-brand-400 transition-colors"
                      title="跳转到此处"
                    >
                      <ArrowRight size={12} />
                    </button>
                    {editingId !== marker.id && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(marker)}
                        className="p-1 rounded hover:bg-surface-600/40 text-surface-400 hover:text-surface-100 transition-colors"
                        title="重命名"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMarker(marker.id)}
                      className="p-1 rounded hover:bg-red-500/15 text-surface-400 hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {duration > 0 && (
        <div className="px-4 py-2 border-t border-surface-700/40 bg-surface-800/30 flex items-center justify-between text-[10px] text-surface-500">
          <span>当前: {formatMarkerTime(currentTime)}</span>
          <span>总时长: {formatMarkerTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
