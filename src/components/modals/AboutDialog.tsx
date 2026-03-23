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
                className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="dialog-in relative w-full max-w-[380px] bg-black/40 backdrop-blur-2xl saturate-150 border border-white/10 rounded-[32px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] overflow-hidden ring-1 ring-white/5 pointer-events-auto"
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
                    <div className="w-full flex flex-col gap-2 mb-6">
                        <button
                            onClick={(e) => openExternalLink(e as any, "https://github.com/SalixJFrost/Lumison")}
                            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/15 bg-white/5 text-sm font-medium text-white/80 hover:bg-white/10 transition cursor-pointer"
                        >
                            <span>{t("about.viewOnGitHub")}</span>
                            <span className="text-[11px] text-white/50">↗</span>
                        </button>

                        <button
                            onClick={(e) => openExternalLink(e as any, "https://github.com/salixfrost")}
                            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/15 bg-white/5 text-sm font-medium text-white/80 hover:bg-white/10 transition cursor-pointer"
                        >
                            <span>{t("about.createdBy")}</span>
                            <span className="text-[11px] text-white/50">↗</span>
                        </button>
                    </div>
                </div>

                {/* Footer / Close */}
                <div className="border-t border-white/10 bg-white/5 p-2">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-2xl text-[16px] font-semibold text-white/90 hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
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
