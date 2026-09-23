-- Local rehearsal only. A Production rollback needs separate Owner approval.
-- Retain receipts/data and the old RPC revoke: never restore the bypass.
begin;
drop function public.provision_store_from_verified_actor(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text
);
commit;
