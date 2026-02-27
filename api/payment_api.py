"""
토스페이먼츠 결제 API
- 결제 승인
- 결제 취소
- 결제 조회
- Supabase DB 연동
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import base64
import os
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter(prefix="/api/payment", tags=["payment"])

# 토스페이먼츠 API 키 (환경변수에서 가져오기)
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY", "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R")
TOSS_API_URL = "https://api.tosspayments.com/v1/payments"

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lszgmmdvpldazzstlewf.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service Role Key 필요

# 상품 정보
PRODUCTS = {
    "premium_monthly": {"name": "프리미엄 월정액", "price": 9900, "type": "subscription", "duration_days": 30},
    "premium_yearly": {"name": "프리미엄 연정액", "price": 79000, "type": "subscription", "duration_days": 365},
    "detailed_analysis": {"name": "상세 사주풀이", "price": 3000, "type": "one_time"},
    "compatibility": {"name": "궁합 분석", "price": 5000, "type": "one_time"},
    "yearly_fortune": {"name": "신년운세 리포트", "price": 9900, "type": "one_time"},
}

# Basic Auth 헤더 생성
def get_auth_header():
    credentials = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()
    return {"Authorization": f"Basic {credentials}"}

# Supabase 헤더
def get_supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def save_payment_to_db(payment_data: dict, order_id: str):
    """결제 정보를 DB에 저장"""
    if not SUPABASE_SERVICE_KEY:
        print("⚠️ SUPABASE_SERVICE_KEY not set, skipping DB save")
        return None
    
    # order_id에서 user_id와 product_id 추출
    # 형식: {product_id}_{user_id}_{timestamp}_{random}
    parts = order_id.split("_")
    product_id = parts[0] if parts else "unknown"
    user_id = parts[1] if len(parts) > 1 and parts[1] != "guest" else None
    
    try:
        async with httpx.AsyncClient() as client:
            # 결제 정보 저장
            payment_record = {
                "payment_key": payment_data.get("paymentKey"),
                "order_id": order_id,
                "product_id": product_id,
                "order_name": payment_data.get("orderName"),
                "amount": payment_data.get("totalAmount"),
                "status": payment_data.get("status", "DONE"),
                "method": payment_data.get("method"),
                "approved_at": payment_data.get("approvedAt"),
                "type": product_id,
                "metadata": {
                    "card": payment_data.get("card"),
                    "easyPay": payment_data.get("easyPay"),
                },
            }
            
            if user_id and user_id != "guest":
                payment_record["user_id"] = user_id
            
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/payments",
                headers=get_supabase_headers(),
                json=payment_record,
                timeout=10.0
            )
            
            if response.status_code not in [200, 201]:
                print(f"⚠️ Payment DB save failed: {response.text}")
                return None
            
            saved_payment = response.json()
            payment_id = saved_payment[0]["id"] if saved_payment else None
            
            # 구독 상품인 경우 구독 정보 생성
            product_info = PRODUCTS.get(product_id)
            if product_info and product_info.get("type") == "subscription" and user_id:
                duration_days = product_info.get("duration_days", 30)
                expires_at = (datetime.utcnow() + timedelta(days=duration_days)).isoformat()
                
                subscription_record = {
                    "user_id": user_id,
                    "plan": product_id,
                    "status": "active",
                    "payment_id": payment_id,
                    "expires_at": expires_at,
                    "auto_renew": True,
                }
                
                # 기존 구독 확인 및 업데이트/생성
                sub_response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/subscriptions",
                    headers={**get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
                    json=subscription_record,
                    timeout=10.0
                )
                
                if sub_response.status_code not in [200, 201]:
                    print(f"⚠️ Subscription DB save failed: {sub_response.text}")
            
            # 단건 상품인 경우 구매 이력 생성
            elif product_info and product_info.get("type") == "one_time" and user_id:
                purchase_record = {
                    "user_id": user_id,
                    "payment_id": payment_id,
                    "product_id": product_id,
                    "product_name": product_info.get("name"),
                    "amount": payment_data.get("totalAmount"),
                }
                
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/purchases",
                    headers=get_supabase_headers(),
                    json=purchase_record,
                    timeout=10.0
                )
            
            return saved_payment
            
    except Exception as e:
        print(f"⚠️ DB save error: {e}")
        return None

async def update_payment_status(payment_key: str, status: str, cancel_reason: str = None):
    """결제 상태 업데이트"""
    if not SUPABASE_SERVICE_KEY:
        return
    
    try:
        async with httpx.AsyncClient() as client:
            update_data = {
                "status": status,
            }
            if cancel_reason:
                update_data["cancel_reason"] = cancel_reason
                update_data["canceled_at"] = datetime.utcnow().isoformat()
            
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/payments?payment_key=eq.{payment_key}",
                headers=get_supabase_headers(),
                json=update_data,
                timeout=10.0
            )
    except Exception as e:
        print(f"⚠️ Payment status update error: {e}")


class PaymentConfirmRequest(BaseModel):
    paymentKey: str
    orderId: str
    amount: int


class PaymentCancelRequest(BaseModel):
    paymentKey: str
    cancelReason: str


@router.post("/confirm")
async def confirm_payment(request: PaymentConfirmRequest):
    """
    결제 승인 요청
    - 프론트엔드에서 successUrl로 리다이렉트 후 호출
    - 승인 성공 시 DB에 결제 정보 저장
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TOSS_API_URL}/{request.paymentKey}",
                headers={
                    **get_auth_header(),
                    "Content-Type": "application/json",
                },
                json={
                    "orderId": request.orderId,
                    "amount": request.amount,
                },
                timeout=30.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # DB에 결제 정보 저장
                await save_payment_to_db(data, request.orderId)
                
                return {
                    "success": True,
                    "payment": {
                        "paymentKey": data.get("paymentKey"),
                        "orderId": data.get("orderId"),
                        "orderName": data.get("orderName"),
                        "totalAmount": data.get("totalAmount"),
                        "status": data.get("status"),
                        "approvedAt": data.get("approvedAt"),
                        "method": data.get("method"),
                    }
                }
            else:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "code": error_data.get("code"),
                        "message": error_data.get("message"),
                    }
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="결제 승인 요청 시간 초과")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_payment(request: PaymentCancelRequest):
    """
    결제 취소 요청
    - 취소 성공 시 DB에서 결제 상태 업데이트
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TOSS_API_URL}/{request.paymentKey}/cancel",
                headers={
                    **get_auth_header(),
                    "Content-Type": "application/json",
                },
                json={
                    "cancelReason": request.cancelReason,
                },
                timeout=30.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # DB에서 결제 상태 업데이트
                await update_payment_status(request.paymentKey, "CANCELED", request.cancelReason)
                
                return {
                    "success": True,
                    "cancels": data.get("cancels"),
                }
            else:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "code": error_data.get("code"),
                        "message": error_data.get("message"),
                    }
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="결제 취소 요청 시간 초과")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{payment_key}")
async def get_payment(payment_key: str):
    """
    결제 정보 조회
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TOSS_API_URL}/{payment_key}",
                headers=get_auth_header(),
                timeout=30.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "payment": data,
                }
            else:
                error_data = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "code": error_data.get("code"),
                        "message": error_data.get("message"),
                    }
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="결제 조회 요청 시간 초과")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription/{user_id}")
async def get_subscription(user_id: str):
    """
    사용자 구독 상태 조회
    - 활성 구독이 있는지 확인
    - 구독 만료일 반환
    """
    if not SUPABASE_SERVICE_KEY:
        return {"has_subscription": False, "reason": "service_key_not_set"}
    
    try:
        async with httpx.AsyncClient() as client:
            # 먼저 만료된 구독 업데이트
            await client.rpc(
                f"{SUPABASE_URL}/rest/v1/rpc/update_expired_subscriptions",
                headers=get_supabase_headers(),
                timeout=5.0
            )
            
            # 활성 구독 조회
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.{user_id}&status=eq.active",
                headers=get_supabase_headers(),
                timeout=10.0
            )
            
            if response.status_code == 200:
                subscriptions = response.json()
                if subscriptions:
                    sub = subscriptions[0]
                    return {
                        "has_subscription": True,
                        "plan": sub.get("plan"),
                        "status": sub.get("status"),
                        "expires_at": sub.get("expires_at"),
                        "auto_renew": sub.get("auto_renew"),
                    }
                else:
                    return {"has_subscription": False}
            else:
                return {"has_subscription": False, "error": response.text}
                
    except Exception as e:
        print(f"Subscription check error: {e}")
        return {"has_subscription": False, "error": str(e)}


@router.get("/purchases/{user_id}")
async def get_purchases(user_id: str, product_id: Optional[str] = None):
    """
    사용자 단건 구매 이력 조회
    - 특정 상품 구매 여부 확인
    """
    if not SUPABASE_SERVICE_KEY:
        return {"purchases": [], "reason": "service_key_not_set"}
    
    try:
        async with httpx.AsyncClient() as client:
            url = f"{SUPABASE_URL}/rest/v1/purchases?user_id=eq.{user_id}"
            if product_id:
                url += f"&product_id=eq.{product_id}"
            url += "&order=created_at.desc&limit=50"
            
            response = await client.get(
                url,
                headers=get_supabase_headers(),
                timeout=10.0
            )
            
            if response.status_code == 200:
                purchases = response.json()
                return {
                    "purchases": purchases,
                    "has_product": bool(purchases) if product_id else None,
                }
            else:
                return {"purchases": [], "error": response.text}
                
    except Exception as e:
        print(f"Purchases check error: {e}")
        return {"purchases": [], "error": str(e)}


@router.get("/check-access/{user_id}/{feature}")
async def check_feature_access(user_id: str, feature: str):
    """
    특정 기능 접근 권한 확인
    - 프리미엄 구독자: 모든 기능 접근 가능
    - 단건 구매자: 해당 상품만 접근 가능
    
    Features:
    - detailed_analysis: 상세 사주풀이
    - compatibility: 궁합 분석
    - yearly_fortune: 신년운세 리포트
    - premium: 프리미엄 기능 전체
    """
    if not SUPABASE_SERVICE_KEY:
        return {"has_access": False, "reason": "service_key_not_set"}
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. 프리미엄 구독 확인
            sub_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.{user_id}&status=eq.active",
                headers=get_supabase_headers(),
                timeout=10.0
            )
            
            if sub_response.status_code == 200:
                subscriptions = sub_response.json()
                if subscriptions:
                    sub = subscriptions[0]
                    # 만료 확인
                    expires_at = sub.get("expires_at")
                    if expires_at:
                        from datetime import datetime
                        expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                        if expires > datetime.now(expires.tzinfo):
                            return {
                                "has_access": True,
                                "access_type": "subscription",
                                "plan": sub.get("plan"),
                                "expires_at": expires_at,
                            }
            
            # 2. 단건 구매 확인 (프리미엄 구독이 없는 경우)
            if feature != "premium":
                purchase_response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/purchases?user_id=eq.{user_id}&product_id=eq.{feature}&used_at=is.null",
                    headers=get_supabase_headers(),
                    timeout=10.0
                )
                
                if purchase_response.status_code == 200:
                    purchases = purchase_response.json()
                    if purchases:
                        return {
                            "has_access": True,
                            "access_type": "one_time",
                            "purchase_id": purchases[0].get("id"),
                        }
            
            return {"has_access": False, "reason": "no_subscription_or_purchase"}
            
    except Exception as e:
        print(f"Access check error: {e}")
        return {"has_access": False, "error": str(e)}


@router.post("/use-purchase/{purchase_id}")
async def use_purchase(purchase_id: str):
    """
    단건 구매 사용 처리
    - 일회성 상품 사용 시 호출
    """
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="service_key_not_set")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/purchases?id=eq.{purchase_id}",
                headers=get_supabase_headers(),
                json={"used_at": datetime.utcnow().isoformat()},
                timeout=10.0
            )
            
            if response.status_code in [200, 204]:
                return {"success": True}
            else:
                raise HTTPException(status_code=400, detail=response.text)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
