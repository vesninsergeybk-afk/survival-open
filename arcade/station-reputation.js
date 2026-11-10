// Local trust measures completed assignments for this specific station.
// A second requirement prevents repeating one fast, high-value task once.
export const STATION_MIN_CONTRACTS=2;

export function stationReputationGoal(station){
 if(station?.id==='0:0')return 0;
 const rank=Math.max(1,Math.min(5,Number.isFinite(station?.rank)?station.rank:1));
 return 3+Math.floor((rank-1)/2);
}

export const stationReputation=station=>
 Math.max(0,Math.min(100,Number.isFinite(station?.reputation)?Math.floor(station.reputation):0));

export const stationContractReputation=choiceId=>choiceId==='standard'?2:1;

export const stationReputationReady=station=>!!station&&
 (station.id==='0:0'||station.active||(!station.enemy&&!station.ruined&&
 (station.hp===undefined||station.hp>0)&&
 (station.contractRuns||0)>=STATION_MIN_CONTRACTS&&
 stationReputation(station)>=stationReputationGoal(station)));

export function awardStationReputation(station,choiceId){
 if(!station||station.id==='0:0'||station.active||station.enemy||station.ruined||
  station.hp<=0)return 0;
 const gain=stationContractReputation(choiceId);
 const previous=stationReputation(station);
 station.reputation=Math.min(stationReputationGoal(station),previous+gain);
 return station.reputation-previous;
}
