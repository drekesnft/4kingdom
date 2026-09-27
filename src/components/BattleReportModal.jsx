import React from 'react'
import { X, Trophy, Skull, ArrowRight, Wheat, ShieldCheck, Pickaxe, Users } from 'lucide-react'

export default function BattleReportModal({ report, onClose }) {
  if (!report) return null

  const isGather = report.type === 'gather'
  const isReinforce = report.type === 'reinforce'
  const isVic = report.isVictory ?? (report.result === 'VICTORIA')

  const headerClass = isGather ? 'gather' : isReinforce ? 'reinforce' : isVic ? 'victory' : 'defeat'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="battle-report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado del Reporte */}
        <div className={`report-modal-header ${headerClass}`}>
          <div className="report-title-group">
            {isGather ? (
              <Wheat size={28} className="report-header-icon gather" />
            ) : isReinforce ? (
              <ShieldCheck size={28} className="report-header-icon reinforce" />
            ) : isVic ? (
              <Trophy size={28} />
            ) : (
              <Skull size={28} />
            )}
            <div>
              <h2>{report.result}</h2>
              <small>{report.targetName} · {new Date(report.timestamp).toLocaleString()}</small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="report-body">
          {/* CASO 1: REPORTE DE RECOLECCIÓN DE RECURSOS */}
          {isGather && (
            <>
              <div className="report-section">
                <h4>🌾 Recursos Recolectados</h4>
                <div className="loot-badges-grid">
                  <div className="loot-badge"><span>🌲</span><strong>+{report.loot?.wood || 0}</strong><small>Madera</small></div>
                  <div className="loot-badge"><span>🪨</span><strong>+{report.loot?.stone || 0}</strong><small>Piedra</small></div>
                  <div className="loot-badge"><span>🌾</span><strong>+{report.loot?.food || 0}</strong><small>Comida</small></div>
                </div>
              </div>

              <div className="report-section">
                <h4>Expedición de Transporte</h4>
                <div className="report-comparison-grid">
                  <div className="comp-col">
                    <small>Tropas Empleadas</small>
                    <strong className="green-val">{report.totalSent}</strong>
                    <p>🗡️ Inf: {report.sent?.infantry || 0} · 🏹 Arq: {report.sent?.archer || 0} · 🐎 Cab: {report.sent?.cavalry || 0}</p>
                  </div>
                  <div className="comp-col">
                    <small>Carga Transportada</small>
                    <strong>{report.totalCollected} / {report.carryCapacity}</strong>
                    <p>Bajas en la marcha: <span className="green-val">0 (Sin incidentes)</span></p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CASO 2: REPORTE DE ENVÍO DE REFUERZOS ALIADOS */}
          {isReinforce && (
            <>
              <div className="report-section">
                <h4>🛡️ Guarnición Desplegada en Base Aliada</h4>
                <div className="reinforce-details-card">
                  <div className="reinforce-ally-meta">
                    <strong>Aliado Protegido:</strong>
                    <span>{report.targetPlayerName} [{report.targetClanTag || 'VAL'}]</span>
                  </div>
                  <div className="reinforce-ally-meta">
                    <strong>Coordenadas del Bastión:</strong>
                    <span>({report.targetX}, {report.targetY})</span>
                  </div>
                </div>

                <div className="report-comparison-grid" style={{ marginTop: '10px' }}>
                  <div className="comp-col">
                    <small>Tropas en Refuerzo</small>
                    <strong className="blue-val">{report.totalSent} unidades</strong>
                    <p>🗡️ Inf: {report.sent?.infantry || 0} · 🏹 Arq: {report.sent?.archer || 0} · 🐎 Cab: {report.sent?.cavalry || 0}</p>
                  </div>
                  <div className="comp-col">
                    <small>Estado de la Guarnición</small>
                    <strong className="green-val">Activa y Vigilante</strong>
                    <p>Defensa del territorio y miembros del clan asegurada.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CASO 3: REPORTES BÉLICOS (NPC, PVP, BASTIONES) */}
          {!isGather && !isReinforce && (
            <>
              {/* Tropas Enviadas vs Que Regresan */}
              <div className="report-section">
                <h4>Tropas</h4>
                <div className="report-comparison-grid">
                  <div className="comp-col">
                    <small>Enviadas</small>
                    <strong>{report.totalSent}</strong>
                    <p>🗡️ Inf: {report.sent?.infantry || 0} · 🏹 Arq: {report.sent?.archer || 0} · 🐎 Cab: {report.sent?.cavalry || 0}</p>
                  </div>
                  <ArrowRight className="arrow-separator" />
                  <div className="comp-col">
                    <small>Regresan con Vida</small>
                    <strong className="green-val">{report.totalReturned}</strong>
                    <p>🗡️ Inf: {report.returned?.infantry || 0} · 🏹 Arq: {report.returned?.archer || 0} · 🐎 Cab: {report.returned?.cavalry || 0}</p>
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
                    <p>🗡️ Inf: {report.casualties?.infantry || 0} · 🏹 Arq: {report.casualties?.archer || 0} · 🐎 Cab: {report.casualties?.cavalry || 0}</p>
                  </div>
                  <div className="comp-col kills">
                    <small>Enemigos Eliminados</small>
                    <strong className="gold-val">{report.totalKills}</strong>
                    <p>🗡️ Inf: {report.enemiesKilled?.infantry || 0} · 🏹 Arq: {report.enemiesKilled?.archer || 0} · 🐎 Cab: {report.enemiesKilled?.cavalry || 0}</p>
                  </div>
                </div>
              </div>

              {/* Botín Obtenido */}
              <div className="report-section loot-section">
                <h4>Botín Obtenido</h4>
                {isVic ? (
                  <div className="loot-badges-grid">
                    <div className="loot-badge"><span>🌲</span><strong>+{report.loot?.wood || 0}</strong><small>Madera</small></div>
                    <div className="loot-badge"><span>🪨</span><strong>+{report.loot?.stone || 0}</strong><small>Piedra</small></div>
                    <div className="loot-badge"><span>🌾</span><strong>+{report.loot?.food || 0}</strong><small>Comida</small></div>
                    {report.kingLoot > 0 && (
                      <div className="loot-badge king"><span>👑</span><strong>+{report.kingLoot}</strong><small>KING</small></div>
                    )}
                  </div>
                ) : (
                  <p className="no-loot-msg">No se obtuvo botín debido a la derrota en combate.</p>
                )}
              </div>
            </>
          )}
        </div>

        <button type="button" className="report-confirm-btn" onClick={onClose}>
          Cerrar Informe
        </button>
      </div>
    </div>
  )
}
