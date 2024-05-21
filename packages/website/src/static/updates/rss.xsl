<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>

  <!-- Output method is HTML -->
  <xsl:output method="html" indent="yes" />

  <!-- Template for the entire document -->
  <xsl:template match="/">
    <html>
      <head>
        <title>
          <xsl:value-of select="atom:feed/atom:title" />
        </title>
        <link rel="stylesheet" type="text/css" href="/breadboard/static/common.css" />
        <link rel="stylesheet" type="text/css" href="/breadboard/static/home.css" />
        <style>
          .container {
          width: 80%;
          margin: 0 auto;
          padding: 20px;
          background: #fff;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          }
          .content-preview-container {
          position: relative;
          margin-top: 10px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          padding: 10px;
          }
          .content-preview {
          font-size: 0.95em;
          color: #555;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 5;
          overflow: hidden;
          position: relative;
          }
          .content-preview:after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2em;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0), #fff);
          }
          h1, h2 {
          color: var(--bb-font-color-accent);
          font-family: var(--bb-font-family-header);
          }
          h1 {
          border-bottom: 2px solid var(--bb-font-color-accent);
          padding-bottom: 10px;
          }
          ul {
          list-style-type: none;
          padding: 0;
          }
          li {
          margin: 20px 0;
          padding: 20px;
          background: #e9ecef;
          border-radius: 8px;
          transition: background 0.3s;
          }
          a {
          text-decoration: none;
          color: var(--bb-font-color-accent);
          font-weight: bold;
          }
          a:hover {
          text-decoration: underline;
          }
          .updated {
          font-size: 0.9em;
          color: var(--bb-font-color-faded);
          }
          .tags {
          margin-top: 10px;
          }
          .tag {
          display: inline-block;
          background-color: #f1f1f1;
          color: #777;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 0.85em;
          margin-right: 5px;
          font-weight: normal;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>
            <xsl:value-of select="atom:feed/atom:title" />
          </h1>
          <h2>
            <xsl:value-of select="atom:feed/atom:subtitle" />
          </h2>
          <p class="updated">
            <em>Last updated: <xsl:value-of select="atom:feed/atom:updated" /></em>
          </p>
          <ul>
            <!-- Template for each entry -->
            <xsl:for-each select="atom:feed/atom:entry">
              <li>
                <a href="{atom:link/@href}">
                  <xsl:value-of select="atom:title" />
                </a>
                <br />
                <span class="updated"><xsl:value-of select="atom:updated" /></span>
                <div class="tags">
                  <xsl:for-each select="atom:category">
                    <span class="tag">
                      <xsl:text>#</xsl:text>
                      <xsl:value-of select="@term" />
                    </span>
                  </xsl:for-each>
                </div>
                <div class="content-preview-container">
                  <div class="content-preview">
                    <xsl:apply-templates select="atom:content" />
                  </div>
                </div>
              </li>
            </xsl:for-each>
          </ul>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- Template to handle the content of the entries -->
  <xsl:template match="atom:content">
    <div>
      <xsl:value-of select="." disable-output-escaping="yes" />
    </div>
  </xsl:template>

</xsl:stylesheet>
