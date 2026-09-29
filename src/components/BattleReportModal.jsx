import React from 'react'
import { X, Trophy, Skull, ArrowRight, Wheat, ShieldCheck, Pickaxe, Users, Compass } from 'lucide-react'

export default function BattleReportModal({ report, onClose }) {
  if (!report) return null

  const isGather = report.type === 'gather'
  const isReinforce = report.type === 'reinforce'
  const isHero = report.type === 'hero'
  const isRanking = report.type === 'ranking' || report.data?.type === 'ranking'
  const isVic = report.isVictory ?? (report.result === 'VICTORIA' || report.result === 'MISIÓN EXITOSA')

  const headerClass = isRanking ? 'victory' : isHero ? (isVic ? 'victory' : 'defeat') : isGather ? 'gather' : isReinforce ? 'reinforce' : isVic ? 'victory' : 'defeat'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="battle-report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado del Reporte */}
        <div className={`report-modal-header ${headerClass}`}>
          <div className="report-title-group">
            {isRanking ? (
              <Trophy size={28} className="gold" />
            ) : isHero ? (
              <Compass size={28} className="report-header-icon hero" />
            ) : isGather ? (
              <Wheat size={28} className="report-header-icon gather" />
            ) : isReinforce ? (
              <ShieldCheck size={28} className="report-header-icon reinforce" />
            ) : isVic ? (
              <Trophy size={28} />
            ) : (
              <Skull size={28} />
            )}
            <div>
              <h2>{isRanking ? '👑 Premio de Ranking Diario' : report.result}</h2>
              <small>{report.targetName} · {new Date(report.timestamp || report.created_at).toLocaleString()}</small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="report-body">
          {/* CASO 0: REPORTE DE RANKING DIARIO */}
          {isRanking && (
            <>
              <div className="report-section">
                <h4>🏆 Liquidación Oficial de Ranking Diario</h4>
                <div style={{
                  background: 'rgba(255, 215, 0, 0.08)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '10px',
                  padding: '16px',
                  margin: '8px 0',
                }}>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#e0e6ed', lineHeight: '1.5' }}>
                    {report.data?.description || report.result || 'Premio oficial acreditado en tu tesorería.'}
                  </p>
                  <div className="loot-badges-grid">
                    <div className="loot-badge king" style={{ background: 'rgba(255, 215, 0, 0.15)', borderColor: '#ffd700' }}>
                      <span>👑</span>
                      <strong style={{ color: '#ffd700', fontSize: '18px' }}>
                        +{report.data?.rewardKing || report.data?.kingLoot || report.kingLoot || 0} KING
                      </strong>
                      <small>Premio Acreditado</small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="report-section">
                <h4>Detalles de Auditoría Militar (00:00 UTC)</h4>
                <div className="report-comparison-grid">
                  <div className="comp-col">
                    <small>Posición Top 5</small>
                    <strong className="gold-val">#{report.data?.rank || 1} Continental</strong>
                    <p>Cuota asignada: <span className="green-val">{report.data?.sharePercent || 0}% del pool</span></p>
                  </div>
                  <div className="comp-col">
                    <small>Poder Militar Auditado</small>
                    <strong className="green-val">⭐ {Number(report.data?.power || 0).toLocaleString()}</strong>
                    <p>Corte diario completado</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CASO 1: REPORTE DE RECOLECCIÓN DE RECURSOS */}
          {!isRanking && isGather && (
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

          {/* CASO 3: REPORTE DE MISIÓN DE HÉROE */}
          {isHero && (
            <>
              <div className="report-section">
                <h4>{isVic ? '🎁 Recompensas de la Expedición' : '⚠️ Sin Recompensas Obtenidas'}</h4>
                {isVic ? (
                  <div className="loot-badges-grid">
                    <div className="loot-badge"><span>🌲</span><strong>+{report.loot?.wood || 0}</strong><small>Madera</small></div>
                    <div className="loot-badge"><span>🪨</span><strong>+{report.loot?.stone || 0}</strong><small>Piedra</small></div>
                    <div className="loot-badge"><span>🌾</span><strong>+{report.loot?.food || 0}</strong><small>Comida</small></div>
                    {report.kingLoot > 0 && (
                      <div className="loot-badge king"><span>👑</span><strong>+{report.kingLoot}</strong><small>KING Drop</small></div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#ff9b9b', fontSize: '12px', margin: '6px 0 0' }}>
                    La expedición no tuvo éxito. El héroe regresó a salvo pero no se obtuvieron recursos en esta incursión.
                  </p>
                )}
              </div>

              <div className="report-section">
                <h4>Detalles de la Misión</h4>
                <div className="report-comparison-grid">
                  <div className="comp-col">
                    <small>Explorador</small>
                    <strong className="green-val">Héroe del Reino</strong>
                    <p>⚡ Energía consumida: 1 · Retorno a salvo</p>
                  </div>
                  <div className="comp-col">
                    <small>Resultado Táctico</small>
                    <strong className={isVic ? 'green-val' : 'red-val'}>
                      {isVic ? 'Incursión Completada' : 'Fracaso en la Exploración'}
                    </strong>
                    <p>Bajas militares: <span className="green-val">0 (Misión individual)</span></p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CASO 4: REPORTES BÉLICOS (NPC, PVP, BASTIONES) */}
          {!isRanking && !isGather && !isReinforce && !isHero && (
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
