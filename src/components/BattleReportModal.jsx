import React from 'react'
import { X, Trophy, Skull, Coins, ArrowRight } from 'lucide-react'

export default function BattleReportModal({ report, onClose }) {
  if (!report) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="battle-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`report-modal-header ${report.isVictory ? 'victory' : 'defeat'}`}>
          <div className="report-title-group">
            {report.isVictory ? <Trophy size={28} /> : <Skull size={28} />}
            <div>
              <h2>{report.result}</h2>
              <small>{report.targetName} · {new Date(report.timestamp).toLocaleString()}</small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="report-body">
          {/* Tropas Enviadas vs Que Regresan */}
          <div className="report-section">
            <h4>Tropas</h4>
            <div className="report-comparison-grid">
              <div className="comp-col">
                <small>Enviadas</small>
                <strong>{report.totalSent}</strong>
                <p>🗡️ Inf: {report.sent.infantry || 0} · 🏹 Arq: {report.sent.archer || 0} · 🐎 Cab: {report.sent.cavalry || 0}</p>
              </div>
              <ArrowRight className="arrow-separator" />
              <div className="comp-col">
                <small>Regresan con Vida</small>
                <strong className="green-val">{report.totalReturned}</strong>
                <p>🗡️ Inf: {report.returned.infantry || 0} · 🏹 Arq: {report.returned.archer || 0} · 🐎 Cab: {report.returned.cavalry || 0}</p>
              </div>
            </div>
          </div>

          {/* Bajas Propias vs Enemigos Eliminados */}
          <div className="report-section">
            <h4>Balance Militar</h4>
            <div className="report-comparison-grid">
              <div className="comp-col danger">
                <small>Tus Bajas</small>
                <strong className="red-val">{report.totalLosses}</strong>
                <p>🗡️ Inf: {report.casualties.infantry || 0} · 🏹 Arq: {report.casualties.archer || 0} · 🐎 Cab: {report.casualties.cavalry || 0}</p>
              </div>
              <div className="comp-col kills">
                <small>Enemigos Eliminados</small>
                <strong className="gold-val">{report.totalKills}</strong>
                <p>🗡️ Inf: {report.enemiesKilled.infantry || 0} · 🏹 Arq: {report.enemiesKilled.archer || 0} · 🐎 Cab: {report.enemiesKilled.cavalry || 0}</p>
              </div>
            </div>
          </div>

          {/* Botín Obtenido */}
          <div className="report-section loot-section">
            <h4>Botín Obtenido</h4>
            {report.isVictory ? (
              <div className="loot-badges-grid">
                <div className="loot-badge"><span>🌲</span><strong>+{report.loot.wood}</strong><small>Madera</small></div>
                <div className="loot-badge"><span>🪨</span><strong>+{report.loot.stone}</strong><small>Piedra</small></div>
                <div className="loot-badge"><span>🌾</span><strong>+{report.loot.food}</strong><small>Comida</small></div>
                {report.kingLoot > 0 && (
                  <div className="loot-badge king"><span>👑</span><strong>+{report.kingLoot}</strong><small>KING</small></div>
                )}
              </div>
            ) : (
              <p className="no-loot-msg">No se obtuvo botín debido a la derrota en combate.</p>
            )}
          </div>
        </div>

        <button type="button" className="report-confirm-btn" onClick={onClose}>
          Cerrar Reporte
        </button>
      </div>
    </div>
  )
}
