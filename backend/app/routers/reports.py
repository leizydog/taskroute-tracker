from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.task import Task
from app.models.user import User
from fpdf import FPDF
import io

router = APIRouter(prefix="/reports", tags=["Reporting"])

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(80)
        self.cell(30, 10, 'TaskRoute Tracker Report', 0, 0, 'C')
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, 'Page ' + str(self.page_no()) + '/{nb}', 0, 0, 'C')

@router.get("/pdf/{report_type}")
def generate_report(report_type: str, db: Session = Depends(get_db)):
    """Generate PDF report on the server"""
    
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_font('Arial', '', 12)

    if report_type == "tasks":
        tasks = db.query(Task).all()
        pdf.cell(0, 10, f'Task Report - Total: {len(tasks)}', 0, 1)
        pdf.ln(4)
        
        # Table Header
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(10, 10, 'ID', 1)
        pdf.cell(80, 10, 'Title', 1)
        pdf.cell(30, 10, 'Status', 1)
        pdf.cell(40, 10, 'Due Date', 1)
        pdf.ln()
        
        # Table Body
        pdf.set_font('Arial', '', 10)
        for task in tasks:
            pdf.cell(10, 10, str(task.id), 1)
            pdf.cell(80, 10, task.title[:35], 1) # Truncate long titles
            pdf.cell(30, 10, task.status, 1)
            pdf.cell(40, 10, str(task.due_date.date()) if task.due_date else 'N/A', 1)
            pdf.ln()
            
    elif report_type == "employees":
        users = db.query(User).all()
        pdf.cell(0, 10, f'Employee Roster - Total: {len(users)}', 0, 1)
        pdf.ln(4)
        
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(10, 10, 'ID', 1)
        pdf.cell(60, 10, 'Name', 1)
        pdf.cell(80, 10, 'Email', 1)
        pdf.cell(30, 10, 'Role', 1)
        pdf.ln()
        
        pdf.set_font('Arial', '', 10)
        for user in users:
            pdf.cell(10, 10, str(user.id), 1)
            pdf.cell(60, 10, user.full_name, 1)
            pdf.cell(80, 10, user.email, 1)
            pdf.cell(30, 10, user.role.value, 1)
            pdf.ln()
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")

    # Output to buffer
    buffer = io.BytesIO()
    pdf_content = pdf.output(dest='S').encode('latin-1')
    buffer.write(pdf_content)
    buffer.seek(0)

    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=report_{report_type}.pdf"}
    )