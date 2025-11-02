#!/usr/bin/env python3
"""
Strapi Skill Update Template
Usage: python update_skill.py <skill_id>

This template helps skill-optimizer update skills in Strapi via API.
Replace the placeholder values below with actual optimized skill content.
"""

import requests
import sys

def update_skill(skill_id, skillmd_content, version, description):
    """Update a skill in Strapi via API"""

    payload = {
        "skillmd": skillmd_content,
        "version": version,
        "description": description
    }

    url = f"http://localhost:3001/api/strapi/skills/{skill_id}"

    try:
        response = requests.put(url, json=payload, headers={"Content-Type": "application/json"})

        if response.status_code == 200:
            print(f"✅ Skill updated successfully to v{version}")
            print(f"   Skill ID: {skill_id}")
            return True
        else:
            print(f"❌ Update failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update_skill.py <skill_id>")
        sys.exit(1)

    skill_id = sys.argv[1]

    # REPLACE THIS WITH OPTIMIZED SKILL CONTENT
    skillmd_content = """---
name: example-skill
description: Example skill description
version: 2.0.0
category: custom
---

# Example Skill

Your optimized skill content here...
"""

    # REPLACE THESE WITH ACTUAL VALUES
    version = "2.0.0"
    description = "Optimized skill description"

    success = update_skill(skill_id, skillmd_content, version, description)
    sys.exit(0 if success else 1)
