import React from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../contexts/I18nContext";
import { invoke } from "@tauri-apps/api/core";

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
    const { t } = useI18n();

    const openExternalLink = async (event: React.MouseEvent | MouseEvent, url: string) => {
        event.preventDefault?.();
        event.stopPropagation?.();

        try {
            await invoke("open_external_url", { url });
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 select-none pointer-events-none"
        >
            <style>{`
        @keyframes modal-in {
            0% { opacity: 0; transform: scale(0.96) translateY(-8px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modal-out {
            0% { opacity: 1; transform: scale(1) translateY(0); }
            100% { opacity: 0; transform: scale(0.98) translateY(4px); }
        }
        .dialog-in { animation: modal-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; will-change: transform, opacity; }
      `}</style>

            {/* Shared backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto cursor-pointer"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="dialog-in relative w-full max-w-[380px] bg-black/40 backdrop-blur-2xl saturate-150 rounded-[32px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] overflow-hidden ring-1 ring-white/5 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative Gradient Blob */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-b from-purple-500/10 via-transparent to-transparent pointer-events-none blur-3xl" />

                {/* Content */}
                <div className="relative p-8 flex flex-col items-center text-center z-10">
                    {/* Title */}
                    <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60 tracking-tight mb-6">
                        Lumison
                    </h3>

                    {/* Description */}
                    <p className="text-white/70 text-[15px] leading-relaxed mb-8 font-medium">
                        {t("about.description")}
                        <br />
                        {t("about.inspiredBy")}
                    </p>

                    {/* Selection List */}
                    <div className="w-full flex flex-col gap-3 mb-6">
                        <button
                            onClick={(e) => openExternalLink(e as any, "https://github.com/SalixJFrost/Lumison")}
                            className="group relative flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/12 bg-white/[0.03] text-sm font-medium text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 cursor-pointer overflow-hidden"
                        >
                            <span className="relative z-10">{t("about.viewOnGitHub")}</span>
                            <span className="relative z-10 text-[11px] text-white/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-300">↗</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </button>

                        <button
                            onClick={(e) => openExternalLink(e as any, "https://github.com/salixfrost")}
                            className="group relative flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/12 bg-white/[0.03] text-sm font-medium text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 cursor-pointer overflow-hidden"
                        >
                            <span className="relative z-10">{t("about.createdBy")}</span>
                            <span className="relative z-10 text-[11px] text-white/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-300">↗</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </button>
                    </div>
                </div>

                {/* Footer / Close */}
                <div className="border-t border-white/10 bg-white/[0.02] p-2">
                    <button
                        onClick={onClose}
                        className="group w-full py-3.5 rounded-2xl text-[16px] font-semibold text-white/70 hover:text-white/90 hover:bg-white/[0.06] active:bg-white/[0.10] active:scale-[0.98] transition-all duration-200"
                    >
                        {t("common.done")}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const TechBadge = ({ label }: { label: string }) => (
    <div className="flex items-center justify-center py-2 px-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
        <span className="text-[11px] font-medium text-white/60">{label}</span>
    </div>
);

export default AboutDialog;
