(function(){
  "use strict";
  /**
   * Read-only cricket scorecard renderer.
   *
   * Presents saved innings and player detail from statData; edits belong in the
   * entry page so archives and reports keep one source of truth.
   */
  const APP=window.UWISportsHub;
  const scorecardId=new URLSearchParams(window.location.search).get("scorecardId")||new URLSearchParams(window.location.search).get("id")||"";
  const els={msg:document.getElementById("pageMessage"),title:document.getElementById("scorecardTitle"),meta:document.getElementById("scorecardMeta"),back:document.getElementById("backLink"),result:document.getElementById("resultText"),venue:document.getElementById("venueText"),body:document.getElementById("scorecardBody")};
  document.addEventListener("DOMContentLoaded",init);
  async function init(){
    const session=await APP.mountSignedInShell({active:"competitions",contextLabel:"View Scorecard"});
    if(!session)return;
    if(!scorecardId){show("Open this page from a saved result.");return;}
    try{
      const row=await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line=normalizeLine(row);
      const data=line.statData||{};
      els.title.textContent=line.eventName||data.title||"Cricket Scorecard";
      els.meta.textContent=[formatDate(line.date),data.uwiTeamName&&data.opponentName?`${data.uwiTeamName} v ${data.opponentName}`:"",data.venue].filter(Boolean).join(" • ");
      els.result.textContent=data.result||"Result recorded";
      els.venue.textContent=data.venue||"";
      els.back.href=line.competitionId?`competition-view.html?id=${encodeURIComponent(line.competitionId)}`:"cricket-results.html";
      render(data);
    }catch(error){show(error?.message||"Scorecard could not be loaded.");}
  }
  function render(data){
    const innings=Array.isArray(data.innings)?data.innings:[];
    els.body.innerHTML=`<div class="section-title"><div><h2>Scorecard</h2><p>${escapeHtml(data.result||"Saved cricket result")}</p></div></div>${innings.map(renderInnings).join("")||'<div class="empty-state">No innings are attached to this scorecard.</div>'}`;
  }
  function renderInnings(innings){
    return `<section class="cricket-entry-section"><div class="cricket-entry-head"><div><h2>${escapeHtml(innings.team||`Innings ${innings.innings}`)}</h2><p>${escapeHtml(formatScore(innings))}${innings.declared?" declared":""}${innings.runRate?` • RR ${escapeHtml(innings.runRate)}`:""}${innings.target?` • Target ${escapeHtml(innings.target)}`:""}</p></div></div><div class="scorecard-table-wrap"><table class="scorecard-table batting-table"><thead><tr><th>Batter</th><th>Dismissal</th><th>Bowler</th><th>Fielder / Keeper</th><th>R</th><th>M</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${(innings.batting||[]).map(renderBatting).join("")}</tbody></table></div><div class="scorecard-totals"><div><strong>Extras</strong><br>${escapeHtml(innings.extras||"")}</div><div><strong>Extras Runs</strong><br>${escapeHtml(innings.extrasRuns??"")}</div><div><strong>Total</strong><br>${escapeHtml(innings.total??"")}</div><div><strong>Wickets</strong><br>${escapeHtml(innings.wickets??"")}</div><div><strong>Overs</strong><br>${escapeHtml(innings.overs||"")}</div></div><div class="filter-grid scorecard-notes"><div><strong>Did Not Bat</strong><p>${escapeHtml((innings.didNotBat||[]).join(", ")||"-")}</p></div><div><strong>Fall Of Wickets</strong><p>${escapeHtml((innings.fallOfWickets||[]).join(", ")||"-")}</p></div></div><div class="scorecard-table-wrap"><table class="scorecard-table"><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Notes</th></tr></thead><tbody>${(innings.bowling||[]).map(renderBowling).join("")}</tbody></table></div></section>`;
  }
  function renderBatting(row){return`<tr><td>${playerLink(row)}</td><td>${escapeHtml(row.dismissalLabel||row.howOut||"")}</td><td>${escapeHtml(row.bowlerName||"")}</td><td>${escapeHtml(row.fielderName||"")}</td><td>${escapeHtml(row.runs??"")}</td><td>${escapeHtml(row.minutes??"")}</td><td>${escapeHtml(row.balls??"")}</td><td>${escapeHtml(row.fours??"")}</td><td>${escapeHtml(row.sixes??"")}</td><td>${escapeHtml(row.strikeRate||"")}</td></tr>`;}
  function renderBowling(row){return`<tr><td>${playerLink(row)}</td><td>${escapeHtml(row.overs||"")}</td><td>${escapeHtml(row.maidens??"")}</td><td>${escapeHtml(row.runs??"")}</td><td>${escapeHtml(row.wickets??"")}</td><td>${escapeHtml(row.economy||"")}</td><td>${escapeHtml(row.notes||"")}</td></tr>`;}
  function playerLink(row){const name=escapeHtml(row.name||"");return row.athleteId?`<a href="athlete-view.html?athleteId=${encodeURIComponent(row.athleteId)}">${name}</a>`:name;}
  function normalizeLine(row){const data=row?.statData&&typeof row.statData==="object"?row.statData:row?.data?.statData&&typeof row.data.statData==="object"?row.data.statData:row?.data&&typeof row.data==="object"?row.data:{};return{...row,...data,id:row.id,competitionId:row.competitionId||data.competitionId,eventName:row.eventName||data.eventName||data.title,date:row.date||data.date||row.createdAt,statData:data};}
  function formatScore(innings){if(!innings||innings.total==null)return"";const wickets=innings.wickets==null?"":`/${innings.wickets}`;const overs=innings.overs?` (${innings.overs} ov)`:"";return`${innings.total}${wickets}${overs}`;}
  function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"":date.toLocaleDateString();}
  function show(text){els.msg.className="message error is-visible";els.msg.textContent=text;}
  function escapeHtml(value){return APP.escapeHtml?APP.escapeHtml(value):String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
})();
