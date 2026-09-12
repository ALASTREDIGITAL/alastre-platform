import {createHash,randomBytes} from "node:crypto";
const b64url=(value:Buffer)=>value.toString("base64url");
export function createOAuthProof(){const state=b64url(randomBytes(32)),verifier=b64url(randomBytes(48)),challenge=b64url(createHash("sha256").update(verifier).digest());return {state,stateHash:hashOAuthState(state),verifier,challenge};}
export function hashOAuthState(state:string){return createHash("sha256").update(state,"utf8").digest("hex");}
export function isAuthorizationSessionValid(session:{status:string;expires_at:string;initiated_by_actor_id:string},actorId:string,now=Date.now()){return session.status==="pending"&&session.initiated_by_actor_id===actorId&&Date.parse(session.expires_at)>now;}
export function safeReturnPath(value:string|null){if(!value||!value.startsWith("/")||value.startsWith("//"))return "/?view=connections";return value.slice(0,500);}
