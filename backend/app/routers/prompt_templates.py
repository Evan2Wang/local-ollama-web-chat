from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PromptTemplate
from app.schemas import PromptTemplateCreate, PromptTemplateOut, PromptTemplateUpdate

router = APIRouter(prefix="/api/prompt-templates", tags=["prompt-templates"])


@router.get("", response_model=list[PromptTemplateOut])
def list_prompt_templates(db: Session = Depends(get_db)):
    return db.scalars(select(PromptTemplate).order_by(PromptTemplate.sort_order, PromptTemplate.created_at)).all()


@router.post("", response_model=PromptTemplateOut)
def create_prompt_template(payload: PromptTemplateCreate, db: Session = Depends(get_db)):
    template = PromptTemplate(**payload.model_dump(), is_builtin=False)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=PromptTemplateOut)
def update_prompt_template(template_id: str, payload: PromptTemplateUpdate, db: Session = Depends(get_db)):
    template = db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, name, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_prompt_template(template_id: str, db: Session = Depends(get_db)):
    template = db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    db.delete(template)
    db.commit()
    return {"ok": True}
