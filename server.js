const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '10.3.104.75';

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://10.3.104.75:8080', 'http://127.0.0.1:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Generate PDF with item details and embedded QR code
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const {
            vendorName,
            lotNumber,
            itemType,
            manufactureDate,
            supplyDate,
            warrantyPeriod
        } = req.body;

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const timestamp = Date.now();
        const filename = `railway-item-${timestamp}.pdf`;
        const filepath = path.join(uploadsDir, filename);
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        doc.fontSize(24).text('Railway Track Fitting Certificate', { align: 'center' });
        doc.moveDown(1.5);

        doc.fontSize(16).text('Item Details', { underline: true });
        doc.moveDown();

        // Generate QR code that points to the generated PDF
        const baseUrl = process.env.NODE_ENV === 'production'
            ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'raildash.onrender.com'}`
            : `http://${HOST}:${PORT}`;
        const pdfUrl = `${baseUrl}/uploads/${filename}`;
        const qrDataUrl = await QRCode.toDataURL(pdfUrl, { width: 200, margin: 2 });
        const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        // Embed QR code in top-right corner
        doc.image(qrImageBuffer, doc.page.width - 150, 50, { width: 100, height: 100 });

        doc.moveDown(1.5);
        doc.fontSize(12);


        doc.text('Vendor Name:', { continued: true }).text(` ${vendorName}`);
        doc.moveDown(0.5);

        doc.text('Lot Number:', { continued: true }).text(` ${lotNumber}`);
        doc.moveDown(0.5);

        doc.text('Item Type:', { continued: true }).text(` ${itemType}`);
        doc.moveDown(0.5);

        if (manufactureDate) {
            doc.text('Manufacture Date:', { continued: true }).text(` ${new Date(manufactureDate).toLocaleDateString()}`);
            doc.moveDown(0.5);
        }

        if (supplyDate) {
            doc.text('Supply Date:', { continued: true }).text(` ${new Date(supplyDate).toLocaleDateString()}`);
            doc.moveDown(0.5);
        }

        if (warrantyPeriod) {
            doc.text('Warranty Period:', { continued: true }).text(` ${warrantyPeriod}`);
            doc.moveDown(1);
        }

        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown();
        doc.text(`Document ID: ${timestamp}`);

        doc.end();

        stream.on('finish', () => {
            res.json({
                success: true,
                filename: filename,
                filepath: `/uploads/${filename}`,
                timestamp: timestamp,
                fullUrl: pdfUrl
            });
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate QR code that links to the PDF (if needed separately)
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        const qrDataUrl = await QRCode.toDataURL(pdfUrl, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        res.json({
            success: true,
            qrCode: qrDataUrl,
            pdfUrl: pdfUrl
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        host: HOST
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'RailTrack Backend API is running',
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, HOST, () => {
    console.log(`Backend server running on ${HOST}:${PORT}`);
    console.log(`Uploads directory: ${uploadsDir}`);
});
